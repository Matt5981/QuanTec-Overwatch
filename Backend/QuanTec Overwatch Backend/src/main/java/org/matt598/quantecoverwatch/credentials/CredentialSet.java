package org.matt598.quantecoverwatch.credentials;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.Serial;
import java.io.Serializable;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.KeySpec;
import java.util.Base64;

public class CredentialSet implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    private String username;
    private String salt;
    private String hash;
    private long lastLogin;
    private CredentialManager.USER_CLASS userClass;
    private String userConfig;
    private String discordAccount;

    // Magic numbers
    private final transient int SALT_SIZE = 16;
    private final transient int ITERATIONS = 65536;
    private final transient int KEY_LEN = 128;

    // Default user settings
    private final transient String DEFAULT_USR_CONFIG =
                    "{" +
                            "\"strDplUnits\":\"GB\"," +
                            "\"strAcc\":1" +
                    "}";

    /** Generates a new credential set. Yes, I know handling passwords as strings is insecure, but it's only for a moment
     * during this constructor, so we should get away with it. Do not use this for constructing these from memory, they're
     * serializable for a reason.
     *
     * @param username The username of the user. This is what will be associated with a bearer token.
     * @param password The password of the user. This will be hashed and checked against by the 'authenticate' method.
     * @param userClass The class of the user, presently either STANDARD or ADMINISTRATOR.
     * @see CredentialManager.USER_CLASS
     */
    public CredentialSet(String username, String password, CredentialManager.USER_CLASS userClass){
        // Store username, hash password and store.
        this.username = username;
        this.userClass = userClass;
        this.userConfig = DEFAULT_USR_CONFIG;
        this.discordAccount = "";
        String salt_tmp = null, hash_tmp = null;
        try {
            SecureRandom random = SecureRandom.getInstanceStrong();
            byte[] salt = new byte[SALT_SIZE];
            random.nextBytes(salt);
            KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LEN);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1");

            salt_tmp = Base64.getEncoder().encodeToString(salt);
            hash_tmp = Base64.getEncoder().encodeToString(factory.generateSecret(spec).getEncoded());

        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            e.printStackTrace();
        }

        this.hash = hash_tmp;
        this.salt = salt_tmp;
    }

    public String getUsername(){
        return this.username;
    }

    public void setUsername(String username){
        this.username = username;
    }

    public CredentialManager.USER_CLASS getUserClass(){
        return this.userClass;
    }

    public void setUserClass(CredentialManager.USER_CLASS userClass){
        this.userClass = userClass;
    }

    public String getUserConfig(){
        return this.userConfig;
    }

    public void setUserConfig(String userConfig){
        this.userConfig = userConfig;
    }

    public long getLastLogin(){
        return this.lastLogin;
    }

    public void setLastLogin(long lastLogin){
        this.lastLogin = lastLogin;
    }

    public String getDiscordAccount(){
        return this.discordAccount;
    }

    public void setDiscordAccount(String discordAccount){
        this.discordAccount = discordAccount;
    }

    // FIXME improper password handling, type should be char[]
    public void changePass(String newPass){
        try {
            SecureRandom random = SecureRandom.getInstanceStrong();
            byte[] salt = new byte[SALT_SIZE];
            random.nextBytes(salt);
            KeySpec spec = new PBEKeySpec(newPass.toCharArray(), salt, ITERATIONS, KEY_LEN);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1");

            this.salt = Base64.getEncoder().encodeToString(salt);
            this.hash = Base64.getEncoder().encodeToString(factory.generateSecret(spec).getEncoded());
        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            e.printStackTrace();
        }
    }

    public boolean authenticate(String password){
        // Hash with our salt and check.
        try {
            KeySpec spec = new PBEKeySpec(password.toCharArray(), Base64.getDecoder().decode(this.salt), ITERATIONS, KEY_LEN);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1");

            return Base64.getEncoder().encodeToString(factory.generateSecret(spec).getEncoded()).equals(this.hash);

        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            e.printStackTrace();
        }

        // In the event of exception
        return false;
    }
}
