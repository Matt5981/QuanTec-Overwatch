package org.matt598.quantecoverwatch.credentials;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.matt598.quantecoverwatch.utils.Logging;
import org.matt598.quantecoverwatch.utils.fetch.Fetch;
import org.matt598.quantecoverwatch.utils.fetch.Response;

// New thing I learnt: Apparently Java implicitly imports any classes that are in the same package as the current class,
// meaning that we don't need to import the credentialSet or BearerToken objects here. Cool!
import java.io.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class CredentialManager {
    private List<CredentialSet> credentialList;
    private final List<BearerToken> tokens;
    private static final String MASTER_USR = "username";
    private static final String MASTER_PSK_CANDIDATE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    private static final int DEFAULT_MASTER_PSK_LENGTH = 32;
    private static final int TOKEN_LIFETIME = 3600; // FIXME 1 Hour, should be 1 day.
    private final Random random;
    private final String filename;
    private final String discordOAuthSecret;
    private final String discordOAuthPublic;
    private final String discordOverrideServer;

    public enum USER_CLASS {
        STANDARD,
        ADMINISTRATOR,
        SUPERUSER
    }

    private static String generatePassword(int size){
        StringBuilder pass = new StringBuilder();
        SecureRandom random = new SecureRandom();
        for(int i = 0; i < size; i++){
            pass.append(MASTER_PSK_CANDIDATE_CHARS.toCharArray()[random.nextInt(MASTER_PSK_CANDIDATE_CHARS.length())]);
        }

        return pass.toString();
    }

    public CredentialManager(String filename, Random random, String discordOAuthPublic, String discordOAuthSecret, String discordOverrideServer){
        this.filename = filename;
        this.discordOAuthPublic = discordOAuthPublic;
        this.discordOAuthSecret = discordOAuthSecret;
        this.discordOverrideServer = discordOverrideServer;
        // Attempt to read the list in from a file.
        try(ObjectInputStream inputStream = new ObjectInputStream(new FileInputStream(filename))) {
            List<?> in = (List<?>)inputStream.readObject();
            List<CredentialSet> out = new LinkedList<>();
            for(Object raw : in){
                out.add((CredentialSet) raw);
            }
            this.credentialList = out;
        } catch (IOException e){
            // Doesn't exist or is bugged, we'll need to do it manually.
            this.credentialList = new LinkedList<>();

            // Add example credentials and save to file.
            String password = generatePassword(DEFAULT_MASTER_PSK_LENGTH);
            Logging.logWarning("[Credential Manager] "+filename+" not found, creating new file with the same name and adding default credentials. You should log in and change these ASAP! Username: \""+MASTER_USR+"\" Password: \""+password+"\".");
            this.credentialList.add(new CredentialSet(MASTER_USR, password, USER_CLASS.SUPERUSER));

            try {
                File test = new File(filename);
                if (test.createNewFile()) {
                    ObjectOutputStream outStream = new ObjectOutputStream(new FileOutputStream(filename));
                    outStream.writeObject(this.credentialList);
                    outStream.flush();
                    outStream.close();
                }
            } catch (IOException ex){
                ex.printStackTrace();
            }

        } catch (ClassNotFoundException e){
            e.printStackTrace();
        }

        // Now that all of that messy stuff is done, make the bearer token list.
        this.tokens = new LinkedList<>();
        this.random = random;
    }

    /** <h2>Credential Set Mutator Handler</h2>
     * This method <b>must</b> be called following any mutations to the credential set list. It updates the credentials
     * file, which ensures it doesn't get outdated when information updates.
     */
    private void credentialSetMutatorHandler(){
        File probe = new File(filename);
        try {
            if(!probe.createNewFile()){
                if(!probe.delete()){
                    // A poor man's 'goto'.
                    throw new IOException();
                }
                if(!probe.createNewFile()){
                    throw new IOException();
                }
            }
            ObjectOutputStream outStream = new ObjectOutputStream(new FileOutputStream(filename));
            outStream.writeObject(this.credentialList);
            outStream.flush();
            outStream.close();
        } catch (IOException e){
            Logging.logError("[CredentialManager] Could not update credential sets.");
        }
    }

    /** <h2>Credential Set Mutator Handler</h2>
     * A variant of the credential set mutator handler that should be called on sensitive operations, for example,
     * changing a user's class, password, or deleting them entirely. This calls the original mutator handler to make
     * the changes persist, then removes any tokens belonging to that user from the token list, forcefully logging them
     * out.
     * @param username The username of the user whom the sensitive operation was the subject of.
     */
    private void credentialSetMutatorHandler(String username){
        credentialSetMutatorHandler();
        tokens.removeIf(token -> token.username.equals(username));
    }

    /** <h2>checkDetails</h2>
     * Checks the username and password.
     * @param username The username to check.
     * @param password The password to check.
     * @return <code>true</code> if the username/password pair is valid, otherwise <code>false</code>.
     */
    public boolean checkDetails(String username, String password){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                return set.authenticate(password);
            }
        }
        return false;
    }

    /** <h2>Discord OAuth Token Exchange</h2>
     * Performs an OAuth token exchange with Discord's API, returning a bearer token that clients can use to connect.
     * As a note, this ONLY uses the Discord token to check the user's snowflake, as to compare it to existing credential sets.
     * The token is not stored, not kept alive, and is replaced by our own.
     * @param code The OAuth code given by Discord's OAuth authorization link.
     * @return A string array containing the username of the user at the zeroth index and the bearer token at the first. If authentication fails for any reason, this will instead return <code>null</code>.
     */
    public String[] discordOAuthTokenExchange(String code){
        if (discordOAuthSecret == null || discordOAuthPublic == null) {
            return null;
        }
        // Compile POST to send to Discord.
        // FIXME this needs to be changed to the actual domain before merging into main!
        Response tokenEx = Fetch.DiscordTokenExchange(discordOAuthPublic, discordOAuthSecret, code, "https://thegaff.dev");
        if(tokenEx == null){
            Logging.logWarning("Fetch for Discord OAuth token exchange returned null.");
            return null;
        }

        // If response is 200, get user's snowflake.
        if(tokenEx.getResponseCode() != 200){
            Logging.logWarning("Discord OAuth token exchange returned "+tokenEx.getResponseCode()+" "+tokenEx.getResponseMessage()+".");
            return null;
        }

        // Strip bearer token from response.
        Pattern btknResp = Pattern.compile("[^{}\"\\t :,]+");
        Matcher btknRes = btknResp.matcher(tokenEx.getResponse());

        if(!btknRes.find()){
            Logging.logWarning("Malformed response received from Discord OAuth token exchange: Regex failed to find match 1.");
            return null;
        }

        if(!btknRes.group().equals("access_token")){
            Logging.logWarning("Malformed response received from Discord OAuth token exchange: First match was not \"access_token\".");
            return null;
        }

        if(!btknRes.find()){
            Logging.logWarning("Malformed response received from Discord OAuth token exchange: Regex failed to find match 2.");
            return null;
        }

        String usrBtkn = btknRes.group();

        // GET /api/users/@me, from which we should yield a user object.
        Response usersAtMe = Fetch.DiscordGetUser(usrBtkn);

        if(usersAtMe == null){
            Logging.logWarning("Fetch for Discord user information returned null.");
            return null;
        }

        if(usersAtMe.getResponseCode() != 200){
            Logging.logWarning("Discord /users/@me returned "+usersAtMe.getResponseCode()+" "+usersAtMe.getResponseMessage()+".");
            return null;
        }

        // Also store the user's guilds, we might need them later.
        Response guildsAtMe = Fetch.discordGetGuilds(usrBtkn);

        if(guildsAtMe == null){
            Logging.logWarning("Fetch for Discord user guild information returned null.");
            return null;
        }

        if(guildsAtMe.getResponseCode() != 200){
            Logging.logWarning("Discord /users/@me/guilds returned "+usersAtMe.getResponseCode()+" "+usersAtMe.getResponseMessage()+".");
            return null;
        }

        // We're just looking for the 'id' field, so we can compare it to the account associated with our account.
        Pattern idPtn = Pattern.compile("[^{}\"\\t :,]+");
        Matcher idRes = idPtn.matcher(usersAtMe.getResponse());

        if(!idRes.find()){
            Logging.logWarning("Malformed response received from Discord User Object: Regex failed to find match 1.");
            return null;
        }

        if(!idRes.group().equals("id")){
            Logging.logWarning("Malformed response received from Discord User Object: First match was not \"id\".");
            return null;
        }

        if(!idRes.find()){
            Logging.logWarning("Malformed response received from Discord User Object: Regex failed to find match 2.");
            return null;
        }

        String id = idRes.group();

        // Revoke the token now that we have that in memory.
        Response revoke = Fetch.DiscordTokenRevoke(usrBtkn, discordOAuthPublic, discordOAuthSecret);
        if(revoke == null){
            Logging.logWarning("Fetch for Discord token revocation returned null.");
            return null;
        }
        if(revoke.getResponseCode() != 200) {
            Logging.logWarning("Revoking a Discord OAuth token returned "+revoke.getResponseCode()+" "+revoke.getResponseMessage()+".");
            return null;
        }

        // FINALLY we can actually check if any credential sets have a discord user snowflake associated with the one we've
        // got. If we don't find one, return null, else generate a bearer token for that user and return it along with their
        // username.
        for (CredentialSet set : credentialList) {
            if (set.getDiscordAccount().equals(id)) {
                // Hit!
                return new String[]{set.getUsername(), createBearerToken(set.getUsername())};
            }
        }

        // If we made it this far then we would usually fail. But, if we have an override guild set, then we
        // need to work out if the user is a member of said guild. If they are, generate a SSO-only user (locked to no permissions)
        // and approve the sign in.
        // I was particularly tired when doing this, so I have done the unforgivable... Destroyed my own morals and used...
        // A DEPENDENCY.
        try {
            ObjectMapper mapper = new ObjectMapper();
            List<Map<String,Object>> guilds = mapper.readValue(guildsAtMe.getResponse(), new TypeReference<>() {});

            for(Map<String,Object> keyval : guilds){
                if(keyval.get("id") != null && keyval.get("id").equals(discordOverrideServer)){
                    // It's a hit! Make new user and send back details.
                    // We'll need to grab the user's name and discriminator to do this, which are conveniently still in memory.
                    Map<String,String> usrInfo = mapper.readValue(usersAtMe.getResponse(), new TypeReference<>() {});
                    String fullName = usrInfo.get("username") + "#" + usrInfo.get("discriminator");
                    credentialList.add(new CredentialSet(fullName, id));
                    Logging.logInfo("[Credential Manager] New SSO-Only user created, with username \""+fullName+"\" due to membership in override server.");
                    return new String[]{fullName, createBearerToken(fullName)};
                }
            }

        } catch (JsonProcessingException e) {
            // Ignored, we'll return null if this happens.
            Logging.logWarning("Exception thrown by Jackson while processing guilds. Printing stack trace:");
            e.printStackTrace();
        }


        Logging.logInfo("[Credential Manager] Discord SSO attempted by unknown user.");
        return null;
    }

    /** <h2>setUsername</h2>
     * Changes the username of a user. Does nothing if no user exists bearing the username {oldUsername}.
     * @param oldUsername The username of the user to change.
     * @param newUsername The new username of the user named in the above parameter.
     */
    public void setUsername(String oldUsername, String newUsername){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(oldUsername)){
                set.setUsername(newUsername);
                credentialSetMutatorHandler(oldUsername);
            }
        }
    }

    /** <h2>setPass</h2>
     * Updates the hash of the specified user by regenerating it with the following password. Does nothing if no user exists bearing the username {username}.
     * @param username The user whose password will be changed.
     * @param password The new password.
     */
    public void setPass(String username, String password){
        // TODO change password parameter to char[] so it can be blanked
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                set.changePass(password);
                credentialSetMutatorHandler(username);
            }
        }
    }

    /** <h2>createBearerToken</h2>
     * Creates a new bearer token, adding it to the credential manager's list. This token is then returned as a
     * Base64-encoded string, which cannot be retrieved again outside of the credential manager class.
     *
     * @param username the username to associate with the bearer token.
     * @return The aforementioned, or <code>null</code> if the username was invalid.
     * @throws IllegalArgumentException if the username provided isn't known to the credentialManager.
     */
    public String createBearerToken(String username){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                BearerToken newToken = new BearerToken(username, TOKEN_LIFETIME, random);
                this.tokens.add(newToken);
                return newToken.token;
            }
        }

        throw new IllegalArgumentException("Provided username not found.");
    }

    /** <h2>getUserClass</h2>
     *
     * Gets the class of the user, as defined in the USER_CLASS enum.
     *
     * @param username The username of the user to check.
     * @return the class of the user, or <code>null</code> if the username is invalid.
     */
    public USER_CLASS getUserClass(String username){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                return set.getUserClass();
            }
        }
        Logging.logWarning("[CredentialManager] getUserClass method returned null due to credential set for user not being found.");
        return null;
    }

    /** <h2>setUserClass</h2>
     * Updates the user class of a user. Returns without doing anything if attempted on an SSO-only account.
     * @param username The username of the account whose class will be changed.
     * @param userClass The new class of the account.
     */
    public void setUserClass(String username, USER_CLASS userClass){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                if(set.getType() == CredentialSet.Types.OVERRIDE){
                    return;
                }
                set.setUserClass(userClass);
                credentialSetMutatorHandler(username);
                return;
            }
        }
        Logging.logWarning("[CredentialManager] setUserPrefs method failed due to credential set for user not being found.");
    }

    public String getUserPrefs(String username){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                return set.getUserConfig();
            }
        }
        Logging.logWarning("[CredentialManager] getUserPrefs method returned null due to credential set for user not being found.");
        return null;
    }

    public void setUserPrefs(String username, String settings){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                set.setUserConfig(settings);
                credentialSetMutatorHandler();
                return;
            }
        }
        Logging.logWarning("[CredentialManager] setUserPrefs method failed due to credential set for user not being found.");
    }

    public String getDiscordID(String username){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                return set.getDiscordAccount();
            }
        }
        Logging.logWarning("[CredentialManager] getDiscordID method returned null due to credential set for user not being found.");
        return null;
    }

    public void setDiscordID(String username, String discordID){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                set.setDiscordAccount(discordID);
                credentialSetMutatorHandler();
                return;
            }
        }
        Logging.logWarning("[CredentialManager] setDiscordID method failed due to credential set for user not being found.");
    }

    public Long getUserLastLogin(String username){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                return set.getLastLogin();
            }
        }

        return null;
    }

    public void setUserLastLogin(String username, long lastLogin){
        for(CredentialSet set : credentialList){
            if(set.getUsername().equals(username)){
                set.setLastLogin(lastLogin);
                credentialSetMutatorHandler();
                return;
            }
        }
        Logging.logError("Unable to set lastlogin value for user \""+username+"\", as the user was not found in the credential list.");
    }

    /** <h2>checkToken</h2>
     * Verifies the provided bearer token.
     *
     * @param token The bearer token to verify, encoded in Base64.
     * @return The username of the user associated with the token, or <code>null</code> if not found.
     */
    public String checkToken(String token){
        for(BearerToken check : tokens){
            if(check.token.equals(token)){
                return check.username;
            }
        }
        return null;
    }

    /** <h2>revokeToken</h2>
     * Revokes the given token. If the provided token is invalid, this method does not do anything. If valid, once this
     * method returns, the provided token will return false when used as the input to <code>checkToken</code>.
     *
     * @param token The token to revoke.
     */
    public void revokeToken(String token){
        // Use convenient Collections method to remove the token from the collection.
        try {
            tokens.removeIf(check -> check.token.equals(token));
            // No mutator handler necessary, since this is what it does anyway, and tokens aren't saved on disk.
        } catch (NullPointerException | UnsupportedOperationException e){
            // ignored
        }
    }

    /** <h2>Get Credential Sets</h2>
     * Returns a string containing JSON of all known credential sets. This has the password salts/hashes redacted for privacy.
     * Notwithstanding, <b>this should only be sent over a secure connection to trusted individuals.</b>
     * @return JSON corresponding to a user, albeit only their username, class and lastLogin Unix timestamp.
     */

    private static String credentialSetJSONTemplate(String username, USER_CLASS userClass, long lastLogin){
        return String.format("{\"username\":\"%s\",\"class\":\"%s\",\"lastlogin\":%d}", username, userClass, lastLogin);
    }

    /** <h2>Remove credential set</h2>
     * Deletes a credential set, then calls the mutator handler to make the changes persist. This operation <b>cannot be undone.</b>
     * @param username The username of the user whose details should be deleted.
     */
    public void removeCredentialSet(String username){
        credentialList.removeIf(filter -> filter.getUsername().equals(username));
        credentialSetMutatorHandler(username);
    }

    public void addCredentialSet(String username, String password) throws IllegalArgumentException {
        // Safe handling of passwords, yay! FIXME

        // First, check if the username already exists, exiting if so.
        for (CredentialSet set : credentialList) {
            if(set.getUsername().equals(username)){
                Logging.logWarning("[CredentialManager] Attempt to create duplicate user with username \""+username+"\" blocked.");
                return;
            }
        }
        credentialList.add(new CredentialSet(username, password, USER_CLASS.STANDARD));
        credentialSetMutatorHandler();
    }

    public String getCredentialSetsAsJSON(){
        // Stringify the credential sets. Easy. Kind of.
        StringBuilder json = new StringBuilder();
        json.append("{\"users\":[");
        for(int i = 0; i < credentialList.size(); i++){
            // We need to use an old-style for loop here since we need to not add a comma to the last one.
            CredentialSet set = credentialList.get(i);
            json.append((i != credentialList.size() - 1) ? credentialSetJSONTemplate(set.getUsername(), set.getUserClass(), set.getLastLogin())+"," : credentialSetJSONTemplate(set.getUsername(), set.getUserClass(), set.getLastLogin()));
        }
        json.append("]}");
        return json.toString();
    }
}
