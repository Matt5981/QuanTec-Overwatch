package org.matt598.quantecoverwatch.credentials;

import java.util.Base64;
import java.util.Random;

public class BearerToken {
    public final String token;
    public final long created;
    public final int lifetime;
    public final String username;
    private boolean sso;

    /** Creates a bearer token for a particular user.
     *
     * @param username the username. Must match an entry in the CredentialManager's list.
     * @param lifetime The amount of time the token will remain in the token list for before being removed, or 'expiring'.
     * @param random An instance of the SecureRandom random number generator.
     * @param sso A boolean specifying whether the token was created using OAuth/Single Sign-On.
     */
    public BearerToken(String username, int lifetime, Random random, boolean sso){
        this.username = username;
        // TODO make size of tokens configurable? check if doing so is redundant, this is only used once here.
        byte[] tkn = new byte[2048];
        random.nextBytes(tkn);
        this.token = Base64.getEncoder().encodeToString(tkn);
        this.created = System.currentTimeMillis() / 1000;
        this.lifetime = lifetime;
        this.sso = sso;
    }

    public boolean isSso() {
        return sso;
    }

    public void invalidateSSO() {
        this.sso = false;
    }
}
