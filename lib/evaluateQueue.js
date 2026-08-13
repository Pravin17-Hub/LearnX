const https = require('https');

// Load API keys from environment
const rawKeys = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
const groqKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.startsWith('gsk_'));

console.log(`[Queue System] Initialized with ${groqKeys.length} Groq API keys.`);

// Queue state
const queue = [];
let activeCount = 0;
const MAX_CONCURRENCY = Math.max(1, groqKeys.length);

// Rate limiting track (key index -> timestamp of last request)
const lastCallTimes = {};

// Safe delay between requests for a single API key to prevent rate limit (5.5 seconds)
const SAFE_KEY_DELAY_MS = 5500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Low level call to Groq using specific key
function fetchFromGroq(apiKey, systemPrompt, userContent) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.0
    });

    const options = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject({ status: 429, message: 'Groq Rate Limit' });
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Groq status ${res.statusCode}: ${body}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const text = parsed.choices?.[0]?.message?.content || '{}';
          let cleanJson = text.trim();
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          }
          resolve(JSON.parse(cleanJson));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Process the next task in queue
async function processQueue() {
  if (queue.length === 0 || activeCount >= MAX_CONCURRENCY) {
    return;
  }

  activeCount++;
  const task = queue.shift();

  // Find a key to use (round robin based on worker slots)
  const workerId = activeCount;
  const keyIndex = workerId % groqKeys.length;
  const apiKey = groqKeys[keyIndex];

  // Enforce delay per API key
  const now = Date.now();
  const lastTime = lastCallTimes[keyIndex] || 0;
  const timePassed = now - lastTime;
  if (timePassed < SAFE_KEY_DELAY_MS) {
    const waitTime = SAFE_KEY_DELAY_MS - timePassed;
    await sleep(waitTime);
  }

  // Update last call time
  lastCallTimes[keyIndex] = Date.now();

  let success = false;
  let retries = 5;
  let retryDelay = 10000;

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Queue System] Processing Q for student. Using key ${keyIndex + 1}/${groqKeys.length}`);
      const result = await fetchFromGroq(apiKey, task.systemPrompt, task.userContent);
      task.resolve(result);
      success = true;
      break;
    } catch (err) {
      if (err.status === 429 || err.message.includes('Limit')) {
        console.warn(`[Queue System] Key ${keyIndex + 1} rate limited. Waiting ${retryDelay / 1000}s to retry...`);
        await sleep(retryDelay);
        retryDelay += 5000;
      } else {
        // For standard network or other errors, retry immediately
        console.error(`[Queue System] Request failed: ${err.message}. Retrying...`);
        await sleep(2000);
      }
    }
  }

  if (!success) {
    task.reject(new Error('AI evaluation failed after multiple retries due to rate limits. Please try again in a few moments.'));
  }

  activeCount--;
  // Check if there are more tasks
  processQueue();
}

function addToQueue(systemPrompt, userContent) {
  return new Promise((resolve, reject) => {
    queue.push({
      systemPrompt,
      userContent,
      resolve,
      reject
    });
    // Trigger processing
    processQueue();
  });
}

module.exports = {
  addToQueue,
  keysCount: groqKeys.length
};
