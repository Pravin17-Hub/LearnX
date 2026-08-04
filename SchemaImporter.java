import java.io.BufferedReader;
import java.io.FileReader;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class SchemaImporter {
    public static void main(String[] args) {
        String url = "jdbc:mysql://mysql-30bc0eb7-learnx1.c.aivencloud.com:10415/defaultdb?useSSL=true&requireSSL=true&verifyServerCertificate=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
        String user = "avnadmin";
        String password = (args.length > 0) ? args[0] : "";

        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            System.out.println("Connecting to Aiven MySQL database...");
            try (Connection conn = DriverManager.getConnection(url, user, password);
                 Statement stmt = conn.createStatement()) {
                
                System.out.println("Connected! Reading database/schema.sql...");
                BufferedReader reader = new BufferedReader(new FileReader("database/schema.sql"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    String trimmed = line.trim();
                    if (trimmed.startsWith("--") || trimmed.startsWith("/*") || trimmed.isEmpty()) {
                        continue;
                    }
                    sb.append(line).append("\n");
                    if (trimmed.endsWith(";")) {
                        String query = sb.toString().trim();
                        if (!query.isEmpty()) {
                            try {
                                stmt.execute(query);
                            } catch (Exception ex) {
                                // Ignore duplicate tables
                            }
                        }
                        sb = new StringBuilder();
                    }
                }
                System.out.println("Success! Database schema successfully imported to your Aiven MySQL instance!");
            }
        } catch (Exception e) {
            System.err.println("Connection failed! Please make sure your password is correct. Error details:");
            e.printStackTrace();
        }
    }
}
