# QuanTec Overwatch
QuanTec Overwatch is a full stack web application designed to aid those who are unfamiliar with the command line in the operation of a server. The app uses Java for its backend, with react/ES6 for the frontend.
#
## Features in current version (v0.3.0)
### For standard users:
- Live-updating view of the server's uptime.
- Live view of the used disk space on each of the server's storage drives. Currently hard-coded.
- Live view of active LXD containers, as well as the systemd service (a game server or something similar) within, and the IP ports said service is listening to.
- Live view of the usage statistics of the 'QuanTec' Discord bot
- Live leaderboard of emoji use, organized by Discord guild.


### For server administrators, or those who need to manage the server's active services:
- The ability to start/stop LXD containers without needing to use the command line,
- The ability to manage users of the webapp, including modifying their usernames/passwords on their behalf.
- The ability to add, remove, or edit words/images that were banned by QuanTec, organized by guild and restricted to those with the `Manage Server` permission on their target guild.
- The ability to download the aggregate image that QuanTec's adaptive filter is using as a comparator.
#
## Development roadmap
Features in this list are slated for development. The top-most version is being worked on right now!
### v0.4 - The administrative update
- Add the ability for administrators to create, start, stop and delete containers.
- Add the (limited) ability to transfer files into the containers.
### v1.0 - The grand update
- UI tweaks, improvements, and optimizations.
#
## Building and Running
Clone the repository, then take the following steps for each component:
### Backend
A dummy user in the LXD group with the name `lxdinteg` is required to run the LXD wrapper utility. This is required for LXD integration. **For security reasons, DO NOT run the server as the `lxdinteg` user, or any other user in sudoers or the LXD group.** Once the user is created, compile `main.c` in the `Backend/LXD Wrapper` folder, naming the resulting binary `lxdwrap`. Move the binary to the user folder of `lxdinteg`, such that the full path to the binary is `/home/lxdinteg/lxdwrap`. Add an entry in sudoers that allows the user you will run the server as to run `lxdwrap` as the `lxdinteg` user.<br><br>
Open the gradle project in your IDE of choice, then build a jar or run the `main` method in `Main.java` directly. <br>**Optional:** Change the port the server runs in by opening `Main.java` in a text editor/IDE, then changing the `public static final int PORT = {your desired TCP port here}`.
### Frontend
Open `src/pages/panes/masterAPIAddress.js` and change the address within to your server's address. The frontend is built in React. As such, simply `cd` into `Frontend/QuanTec Overwatch Frontend` and run `npm run build` to generate a build folder, which can then be hosted on your web server of choice.
### Setup for 'Sign in with Discord'
To make the 'sign in with Discord' button work, you need your Discord user ID. To get this, simply mention yourself in a message (bot spam channels work well for this), but put a backslash before the `@`, for example, `\@JohnDoe#1234`. This will return something that looks like this:
```
<@12345678912345678>
```
Copy the number only (without the brackets or `@`) into the `Authorized Discord Account` text box in the Settings tab, then wait until it turns green. From that point on, you can click 'sign in with Discord' on the login screen and use your discord account to log in instead of your password.
#
## Acknowledgements
The members of the Gaff Discord server for testing the program.