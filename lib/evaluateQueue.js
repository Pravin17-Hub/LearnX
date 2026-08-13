const https = require('https');

// Load primary API key from environment
const groqApiKey = process.env.GROQ_API_KEY || '';

console.log(`[Queue System] Initialized with primary Groq API key.`);

// Queue state
const queue = [];
let activeCount = 0;
const MAX_CONCURRENCY = 1; // Strict sequential processing to prevent rate limit on 1 key

// Safe delay between requests to prevent rate limit (5.5 seconds)
const SAFE_DELAY_MS = 5500;
let lastCallTime = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Low level call to Groq using the key
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

  // Enforce delay per request
  const now = Date.now();
  const timePassed = now - lastCallTime;
  if (timePassed < SAFE_DELAY_MS) {
    const waitTime = SAFE_DELAY_MS - timePassed;
    await sleep(waitTime);
  }

  // Update last call time
  lastCallTime = Date.now();

  let success = false;
  let retries = 5;
  let retryDelay = 15000;

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Queue System] Processing descriptive answer evaluation...`);
      const result = await fetchFromGroq(groqApiKey, task.systemPrompt, task.userContent);
      task.resolve(result);
      success = true;
      break;
    } catch (err) {
      if (err.status === 429 || err.message.includes('Limit')) {
        console.warn(`[Queue System] Rate limited. Waiting ${retryDelay / 1000}s to retry...`);
        await sleep(retryDelay);
        retryDelay += 5000;
      } else {
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

export function addToQueue(systemPrompt, userContent) {
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
