package com.learnx.listener;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;
import com.learnx.util.BackgroundTaskManager;

@WebListener
public class AppLifecycleListener implements ServletContextListener {

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        System.out.println("LearnX Web Application Initialized successfully.");
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        System.out.println("LearnX Web Application context destroyed. Initiating background cleanup...");
        BackgroundTaskManager.shutdown();
    }
}
