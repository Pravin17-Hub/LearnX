package com.learnx.util;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class BackgroundTaskManager {
    // Central thread pool with fixed size of 4 threads to prevent system thread exhaustion
    private static final ExecutorService executorService = Executors.newFixedThreadPool(4);

    public static void runAsync(Runnable task) {
        executorService.submit(task);
    }

    public static void shutdown() {
        System.out.println("BackgroundTaskManager: Shutting down background thread pool...");
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                System.err.println("BackgroundTaskManager: Thread pool did not terminate. Forcing shutdown...");
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        System.out.println("BackgroundTaskManager: Clean shutdown complete.");
    }
}
