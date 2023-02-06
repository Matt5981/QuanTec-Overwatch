# API Methods

Any API call should use the POST http method. GET returns a stub, and DELETE/PUT are not presently supported, returning `400`.
A connection to the API must be authenticated before being processed. The server runs on 8443/tcp with TLSv1.3 only. The API runs strictly in a request/response model, communications are entirely initiated by clients.

## Authentication
Authentication is done via the HTTP `Authorization` header with the `Bearer` token method, and is required for all API operations, except `/auth`. To obtain one, send the following JSON in a POST to the `/auth` endpoint:
```json
{
  "username": "{Your username here}",
  "password": "{Your password here}"
}
```
If the username and password are correct, the server will return `200` with the following JSON:
```json
{
  "token": "{Bearer token here}"
}
```
The token provided must be used in an `Authorization: Bearer {token}` header for requests outside the `/auth` endpoint.
OAuth2 tokens can also be obtained through Discord's OAuth2 platform, as is done by the webapp.

## Requests
The api segregates requests into two types. It discerns the type of any given request based on the Content-Type header:

### text/plain
Command. The response code indicates if it succeeded (200/204), if it didn't (400/401/403), or if the server threw an exception while running it (500).
This may also be used for JSON if it is used as the argument for a command. For reference, the following response codes are used:
- `200 OK`
  - Request succeeded, body may or may not be present. This is returned for most methods that request data *from* the server.
- `204 No Content`
  - Request succeeded, body is not present. This is returned for most methods that send data *to* the server.
- `400 Bad Request`
  - Request failed, request was bad. Either a valid command was not found in the `POST` body, a `PUT` or `DELETE` method was used, the `Content-Type: application/json` header was present or another error occurred.
- `401 Unauthorized`
  - Request failed, either an invalid token was provided or none at all. Note that certain operations performed by other users can spontaneously invalidate a token. Clients will **not** be notified of this.
- `403 Forbidden`
  - Request failed, the user associated with the token used was not an `ADMINISTRATOR`, and as such cannot perform the operation.

### application/json
Data record, used for updating the DB. This is not presently implemented, and as such the server will return `400` if a `Content-Type: application/json` header is present.

## API Methods - text/plain


### `GETMEMUSAGE`
Returns JSON containing the server's usage stats, accurate at the time of sending the POST only:

```json
{
  "uptime": 12345,
  "storage": {
    "boot": "123/123",
    "storage": "123/123",
    "lxd": "123/123"
  }
}
```

**Units:**
- `uptime` - seconds
- all values under the `storage` table - bytes


### `GETUSERSETTINGS`
Returns the following json containing the user's settings. This is subject to change, and the below values are examples only.
```json
{
  "strDplUnits": "GB",
  "strAcc": 3
}
```

### `UPDATEUSERSETTINGS`
Updates user settings for the user associated with the token in use. Expects two lines in a response, the first should be `UPDATEUSERSETTINGS`, with the
second containing the user settings JSON, as returned by `GETMEMUSAGE` (albeit with different values).