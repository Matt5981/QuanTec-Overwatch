package org.matt598.quantecoverwatch.utils.fetch;

public class Response {
    private final int responseCode;
    private final String responseMessage;
    private final String HTTPVers;
    private final String response;

    public Response(int responseCode, String responseMessage, String HTTPVers, String response) {
        this.responseCode = responseCode;
        this.responseMessage = responseMessage;
        this.HTTPVers = HTTPVers;
        this.response = response;
    }

    public int getResponseCode() {
        return responseCode;
    }

    public String getResponseMessage() {
        return responseMessage;
    }

    public String getHTTPVers() {
        return HTTPVers;
    }

    public String getResponse() {
        return response;
    }
}
