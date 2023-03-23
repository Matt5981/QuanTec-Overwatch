package org.matt598.quantecoverwatch.utils;

import org.matt598.quantecoverwatch.commands.UsageStats;
import org.matt598.quantecoverwatch.credentials.CredentialManager;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URL;

public class ResponseTemplates {

    public static final String STDHEADERS =
            // STOPSHIP change back to https://thegaff.dev!
            // TODO don't send Access-Control-Expose-Headers: Set-Cookie unless it's an auth request.
            "Server: QuanTec\r\n" +
                    Logging.getDateHeader() + "\r\n" +
                    "Strict-Transport-Security: max-age=31536000; includeSubDomains\r\n" +
                    "Connection: Keep-Alive\r\n" +
                    "Access-Control-Allow-Origin: http://localhost:3000\r\n" +
                    "Access-Control-Allow-Credentials: true\r\n" +
                    "Access-Control-Expose-Headers: Set-Cookie\r\n";

    public static String CORSOPTIONS(String origin) {
        return "HTTP/1.1 204 No Content\r\n" +
                "Server: QuanTec\r\n" +
                Logging.getDateHeader() + "\r\n" +
                "Strict-Transport-Security: max-age=31536000; includeSubDomains\r\n" +
                "Connection: Keep-Alive\r\n" +
                "Access-Control-Allow-Origin: " + origin + "\r\n" +
                "Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type, Authorization, Cookie\r\n" +
                "Access-Control-Expose-Headers: Set-Cookie\r\n" +
                "Access-Control-Allow-Credentials: true\r\n" +
                "Access-Control-Max-Age: 3600\r\n" +
                "\r\n";
    }

    // Retain 'Connection: Keep-Alive' in case the user wants to re-authenticate.
    // TODO rename, something like "GenericNoContent"
    public static String LOGOUT =
            "HTTP/1.1 204 No Content\r\n" +
                    STDHEADERS +
                    "\r\n";

    public static String ValidAuthRequest(String token){
        return "HTTP/1.1 204 No Content\r\n" +
                STDHEADERS +
                // STOPSHIP set the 'Secure' and 'SameSite' attributes BEFORE deploying! ; SameSite=Strict
                "Set-Cookie: btkn="+token+"; path=/; HttpOnly; Max-Age: 3600; SameSite=Strict\r\n" +
                "\r\n";
    }

    // Discord OAuth variant of the above.
    public static String validAuthRequest(String json, String token) {
        return  "HTTP/1.1 200 OK\r\n" +
                STDHEADERS +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + json.length() + "\r\n" +
                // STOPSHIP set the 'Secure' and 'SameSite' attributes BEFORE deploying! ; SameSite=Strict
                "Set-Cookie: btkn="+token+"; path=/; HttpOnly; Max-Age: 3600; SameSite=Strict\r\n" +
                "\r\n" +
                json;
    }

    public static final String GET =
            "HTTP/1.1 200 OK\r\n" +
                    STDHEADERS +
                    "Content-Type: text/html; charset=utf-8\r\n" +
                    "Content-Length: "+htmlFileProvider().length()+"\r\n" +
                    "\r\n" +
                    htmlFileProvider();

    // TODO merge GETSETTINGS() into GenericJSON()
    /** <h2>GETSETTINGS</h2>
     * A 200 response containing the user's preferences.
     * @param userPrefs The user preferences of the user, stored as a JSON string.
     * @return An HTTP response containing the JSON along with required headers for ajax to interpret it.
     * @see CredentialManager
     */
    public static String GETSETTINGS(String userPrefs, CredentialManager.USER_CLASS userClass) {
        // Make json separately.
        String json = String.format("{\"userSettings\":%s,\"userClass\":\"%s\"}", userPrefs, userClass);

        return  "HTTP/1.1 200 OK\r\n" +
                STDHEADERS +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + json.length() + "\r\n" +
                "\r\n" +
                json;
    }

    public static final String UNAUTH =
            "HTTP/1.1 401 Unauthorized\r\n" +
                    STDHEADERS +
                    "WWW-Authenticate: Bearer realm=\"QuanTec\"\r\n" +
                    "Content-Type: text/plain\r\n" +
                    "Content-Length: 51\r\n" +
                    "\r\n" +
                    "Authentication is required to access this resource.";

    public static final String FORBIDDEN =
            "HTTP/1.1 403 Forbidden\r\n" +
                    STDHEADERS +
                    "Content-Length: 0\r\n" +
                    "\r\n";

    public static final String BADREQ =
            "HTTP/1.1 400 Bad Request\r\n" +
                    STDHEADERS +
                    "Content-Type: text/plain\r\n" +
                    "Content-Length: 11\r\n" +
                    "\r\n" +
                    "Bad Request";

    public static final String INTERR =
            "HTTP/1.1 500 Internal Server Error\r\n" +
                    STDHEADERS +
                    "Content-Length: 45\r\n" +
                    "Content-Type: text/plain\r\n" +
                    "\r\n" +
                    "You've met with a terrible fate, haven't you?";

    // TODO HTTP/1.1 compliance
    public static final String CHUNKING =
            "HTTP/1.1 501 Not Implemented\r\n" +
                    STDHEADERS +
                    "Content-Length: 34\r\n" +
                    "Content-Type: text/plain\r\n" +
                    "\r\n" +
                    "Chunked encoding is not supported.";

    public static String SysInfo() {

        String ret = UsageStats.getUsageStats();

        return  "HTTP/1.1 200 OK\r\n" +
                STDHEADERS +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + ret.length() + "\r\n" +
                "\r\n" +
                ret;
    }

    public static String genericJSON(String json) {
        return  "HTTP/1.1 200 OK\r\n" +
                STDHEADERS +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + json.length() + "\r\n" +
                "\r\n" +
                json;
    }


    private static String htmlFileProvider(){
        StringBuilder page = new StringBuilder();
        URL file = Thread.currentThread().getContextClassLoader().getResource("pages/get.html");
        if(file == null){
            throw new NullPointerException("File not found.");
        }
        try(BufferedReader reader = new BufferedReader(new InputStreamReader(file.openStream()))) {
            String out = reader.readLine();
            while(out != null){
                page.append(out);
                out = reader.readLine();
            }
        } catch (IOException | NullPointerException e) {
            e.printStackTrace();
        }

        // FIXME content returns with \t chars
        //System.out.println(page);
        return page.toString();
    }

}
