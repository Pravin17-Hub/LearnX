# Use official lightweight Tomcat image with Java 17
FROM tomcat:9-jdk17-openjdk-slim

# Set environment variables
ENV CATALINA_HOME /usr/local/tomcat
ENV PATH $CATALINA_HOME/bin:$PATH

# Copy the pre-built WAR file as the ROOT application
# (This makes your website load directly at https://your-site.onrender.com/)
COPY LearnX.war /usr/local/tomcat/webapps/ROOT.war

EXPOSE 8080

CMD ["catalina.sh", "run"]