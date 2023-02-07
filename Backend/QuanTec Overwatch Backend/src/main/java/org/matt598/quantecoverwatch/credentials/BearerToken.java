package org.matt598.quantecoverwatch.credentials;

import java.util.Base64;
import java.util.Random;

public class BearerToken {
    public final String token;
    public final long created;
    public final int lifetime;
    public final String username;

    /** Creates a bearer token for a particular user.
     *
     * @param username the username. Must match an entry in the CredentialManager's list.
     */
    public BearerToken(String username, int lifetime, Random random){
        this.username = username;
        // TODO make size of tokens configurable? check if doing so is redundant, this is only used once here.
        byte[] tkn = new byte[4096];
        random.nextBytes(tkn);
        this.token = Base64.getEncoder().encodeToString(tkn);
        this.created = System.currentTimeMillis() / 1000;
        this.lifetime = lifetime;
    }
}
