import React from 'react';
import { SERVER_IP } from './masterAPIAddress';
import './settings.css';
import './UserClassHeirarchy.js';
import { USER_CLASSES } from './UserClassHeirarchy.js';
import { sanitizePassword } from './passwordSanitizer.ts';

// TODO this whole file contains a bunch of inefficient code. It needs to be heavily refactored before 1.0.

class Settings extends React.Component {

    constructor(props){
        super(props);
        
        this.state = {
            settings: JSON.parse(localStorage.getItem('usrSettings')),
            authorizedDiscordAcc: null,
            discordAccSaveInProgress: 0,
            userList: undefined,
            shouldSavingBeVisible: false,
            shouldNewUserDialogBeVisible: false,
            currentUserDetailChangeDialog: null,
            shouldSubmitBeClickable: false,
            editUserDropdown: null,
            newUser: {
                username: "",
                password: ""
            },
            changeUsername: {
                username: '',
                confirmUser: ''
            },
            changeOtherPass: {
                password: '',
                confirmPass: ''
            },
            changeOwnPass: {
                oldPassword: '',
                password: '',
                confirmPass: ''
            }
        };

        this.onSettingsUpdate = this.onSettingsUpdate.bind(this);
        this.sendToServer = this.sendToServer.bind(this);
        this.launchNewUserWizard = this.launchNewUserWizard.bind(this);
        this.onNewUserFormChange = this.onNewUserFormChange.bind(this);
        this.onNewUserFormSubmit = this.onNewUserFormSubmit.bind(this);
        this.onNewUserFormCancel = this.onNewUserFormCancel.bind(this);
        this.onUserClassChange = this.onUserClassChange.bind(this);
        this.onUserDelete = this.onUserDelete.bind(this);
        this.onUserEditClick = this.onUserEditClick.bind(this);
        this.onDiscordAccEdit = this.onDiscordAccEdit.bind(this);

        // Grab discord account ID.
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETDISCORDID'})).then(
            res => {return res.json();}
        ).then(
            res => {this.setState({authorizedDiscordAcc: res.id});}
        )
        
        // This fetch is admin-only, so we need to check it before we get the userlist, otherwise it fills the console with errors since the API will return 403.
        if(USER_CLASSES[localStorage.getItem('usrClass')] >= USER_CLASSES['ADMINISTRATOR']){
            fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETALLUSERS'})).catch(
                NetworkError => this.setState({userList: null})
            ).then(
                res => {return res.json();}
            ).then(
                res => this.setState({userList: res.users})
            );
        }
    }

    onSettingsUpdate(event){
        event.preventDefault();
        this.setState({
            shouldSavingBeVisible: true
        });
        // Modify settings object, then send it in a POST to the backend.
        switch(event.target.id){
            case 'storageDisplayUnitSelect':
                this.setState({settings: {
                    strDplUnits: event.target.value,
                    strAcc: this.state.settings.strAcc
                }}, this.sendToServer);
                break;
            case 'storageDisplayAccuracySelect':
                this.setState({settings: {
                    strDplUnits: this.state.settings.strDplUnits,
                    strAcc: event.target.value
                }}, this.sendToServer);
                break;

            default:
                console.log('onSettingsUpdate() switched on an illegal value!');
        }
    }

    sendToServer(){
        // Save to LS
        localStorage.setItem('usrSettings', JSON.stringify(this.state.settings));

        // Launch to server.
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'UPDATEUSERSETTINGS\n'+JSON.stringify(this.state.settings)})).then(
            res => {
                // Response received, hide the 'saving' message.
                this.setState({shouldSavingBeVisible: false});
            }
        );
    }

    launchNewUserWizard(event){
        switch(event.target.id){
            case 'newUserLaunch':
                this.setState({currentUserDetailChangeDialog: 'newUser'});
                break;
            case 'changeOtherUsername':
                this.setState({currentUserDetailChangeDialog: 'changeUsername'});
                break;
            case 'changeOtherPassword':
                this.setState({currentUserDetailChangeDialog: 'changeOtherPass'});
                break;
            case 'changeOwnPassword':
                this.setState({currentUserDetailChangeDialog: 'changeOwnPass'});
                break;
            default:
                this.setState({currentUserDetailChangeDialog: null});
                break;
        }
    }

    onNewUserFormChange(event){
        let mutated = this.state[this.state.currentUserDetailChangeDialog];
        mutated[event.target.id] = event.target.value;

        // If it's not the 'new user' form, then make sure that 1. all fields in the mutated object are blank, AND 2. all fields match. If this is false,
        // disable the submit button.

        // The blank check happens regardless of whether or not it's the 'newUser' form, since making a user with a blank name/password will make the server return 400.

        var submitButtonState = true;

        for(var key in mutated){
            if(mutated[key] === ''){
                submitButtonState = false;
            }
        }

        if(this.state.currentUserDetailChangeDialog !== 'newUser' && this.state.currentUserDetailChangeDialog !== 'changeOwnPass'){

            for(var key in mutated){
                if(mutated[key] !== Object.values(mutated)[0]){
                    submitButtonState = false;
                }
            }
        }

        if(this.state.currentUserDetailChangeDialog === 'changeOwnPass'){
            // Make sure 'password' and 'confirmPass' are the same.
            submitButtonState = submitButtonState && mutated.password === mutated.confirmPass;
        }

        this.setState({
            [this.state.currentUserDetailChangeDialog]: mutated,
            shouldSubmitBeClickable: submitButtonState
        });
    }

    onNewUserFormCancel(event){
        // Cancel clicked, erase form and add 'hidden' attribute back to the dialog box.
        let mutated = this.state[this.state.currentUserDetailChangeDialog];

        for(var key in mutated){
            mutated[key] = '';
        }

        this.setState({
            [this.state.currentUserDetailChangeDialog]: mutated,
            currentUserDetailChangeDialog: null,
            shouldSubmitBeClickable: false
        });
    }

    onNewUserFormSubmit(event){
        event.preventDefault();
        event.target.enabled = false;

        // We need to do some assembly here since each of the four forms this page hosts sends a different command to the API. We also need to sanitize passwords since login does it.
        var reqBody;
        switch(this.state.currentUserDetailChangeDialog){
            case 'newUser':
                reqBody = 'NEWUSER\n'+
                this.state.newUser.username+'\n'+
                sanitizePassword(this.state.newUser.password); 
                break;
            case 'changeUsername':
                reqBody = 'CHANGEUSERNAME\n' +
                this.state.editUserDropdown+'\n'+
                this.state.changeUsername.username;
                break;
            case 'changeOtherPass':
                reqBody = 'CHANGEPASS\n' +
                this.state.editUserDropdown+'\n'+
                sanitizePassword(this.state.changeOtherPass.password);
                break;
            case 'changeOwnPass':
                reqBody = 'CHANGEOWNPASS\n'+
                JSON.stringify({oldPassword: sanitizePassword(this.state.changeOwnPass.oldPassword), newPassword: sanitizePassword(this.state.changeOwnPass.password)});
                break;
            default:
                reqBody = '';
                break;
        }
        // Now that that's assembled, we also need to get ready to wipe the corresponding form's contents when this completes, since we don't want to do
        // that if it fails.
        let erasureSubjectName = this.state.currentUserDetailChangeDialog;
        let mutated = {
            ...this.state[erasureSubjectName]
        };
        
        for(var key in mutated){
            mutated[key] = '';
        }

        // Send new details in POST to API. Since the server might throw an error here, there needs to be handling for it (e.g. a user can try to make a user with a duplicate name, which will return 400.)
        // We also need a custom dialog for the old password in changing one's own password returning 403, since it's likely to be encountered more then the others (which cannot happen via the UI without modifying it).
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: reqBody})).then(
            res => {

                if(this.state.currentUserDetailChangeDialog === 'changeOwnPass'){
                    if(res.status === 403){
                        alert('Your old password was incorrect. Please enter it again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                    } else if(res.status !== 204){
                        alert('Server returned '+res.status+'. Please try again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                    } else {
                        this.setState({
                            currentUserDetailChangeDialog: null,
                            shouldSubmitBeClickable: false,
                            [erasureSubjectName]: mutated
                        });
                    }
                } else {
                    if(res.status !== 204){
                        alert('Server returned '+res.status+'. Please try again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                    } else {
                        // Fetch new user list and shove it into state, which should make the render method show our changes.
                        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETALLUSERS'})).catch(
                            NetworkError => this.setState({userList: null})
                        ).then(
                            res => {return res.json();}
                        ).then(
                            res => this.setState({
                                userList: res.users,
                                currentUserDetailChangeDialog: null,
                                shouldSubmitBeClickable: false,
                                [erasureSubjectName]: mutated
                            })
                        ); 
                    }
                }
            }
        )
    }



    onUserClassChange(event){
        event.preventDefault();
        // Requires a request to server, followed by another fetch of the user list. TODO loading screen/text, like the one for saving user settings.
        // The string needs to be edited first though, as the ID is prepended with 'classSwitch' to prevent CSS shenanigans.
        let username = event.target.id.substring(11);
        let userClass = event.target.value;
        event.target.enabled = false;

        // If the username is equal to the current user, ignore it. This should be impossible since a switch element (or a delete button, for that matter) isn't generated for the current user's column,
        // but in case that fails for whatever reason, or in case the user is digging around in the JS console this is here as a failsafe.
        if(username === localStorage.getItem('username')){
            alert('Users can not set their own permission level. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
            return;
        }
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'SETUSERCLASS\n'+username+'\n'+userClass})).then(
            res => {
                if(res.status !== 204){
                    alert("Server returned "+res.status+'. Please try again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                } else {
                    // Fetch username list again and let setState redraw the table.
                    fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETALLUSERS'})).catch(
                        NetworkError => this.setState({userList: null})
                    ).then(
                        res => {return res.json();}
                    ).then(
                        res => this.setState({userList: res.users})
                    ); 
                }
            }
        );
    }

    // TODO add confirmation dialog here.
    onUserDelete(event){
        event.preventDefault();
        let username = event.target.id.substring(7);
        event.target.enabled = false;

        if(username === localStorage.getItem('username')){
            alert('Users can not self-destruct. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
            return;
        }
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'DELETEUSER\n'+username})).then(
            res => {
                if(res.status !== 204){
                    alert("Server returned "+res.status+'. Please try again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                } else {
                    // Fetch username list again and let setState redraw the table.
                    fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETALLUSERS'})).catch(
                        NetworkError => this.setState({userList: null})
                    ).then(
                        res => {return res.json();}
                    ).then(
                        res => this.setState({userList: res.users})
                    ); 
                }
            }
        ); 
    }

    formatTimestamp(lastLogin){
        // Format a UNIX timestamp into a human-readable date.
        let date = new Date(lastLogin * 1000);
        return date.getDate()+'/'+(date.getMonth()+1)+'/'+date.getFullYear()+' @ '+date.getHours().toString().padStart(2, '0')+':'+date.getMinutes().toString().padStart(2, '0')+':'+date.getSeconds().toString().padStart(2, '0');
    }

    onUserEditClick(event){
        this.setState({
            editUserDropdown: event.target.id.substring(8)
        });
    }

    onDiscordAccEdit(event){

        // setState and actually act on it once it finishes.
        this.setState({
            authorizedDiscordAcc: event.target.value,
        },
        () => {
            // If inProgress is 1 already, don't touch it. If it's zero or two,
            // set to one and begin the three second countdown to saving it.
            if(this.state.discordAccSaveInProgress !== 1){
                this.setState({discordAccSaveInProgress: 1})
                setTimeout(() => {
                    fetch(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'SETDISCORDID\n'+(this.state.authorizedDiscordAcc === '' ? 'null' : this.state.authorizedDiscordAcc)}).then(
                        res => {
                            if(res.status === 204){
                                this.setState({
                                    discordAccSaveInProgress: 2,
                                })
                            }
                        }
                    )
                }, 3000);
            }
        });

    }

    render(){

        if(!this.props.enabled){
            return;
        }

        if(this.state.settings === null) {
            // Hacky fix for the settings object magically deleting itself when the component redraws. TODO figure out why the state gets nulled, but the constructor isn't rerun?
            return (<p>Waiting for JSON to parse...</p>);
        }

        // Null check for the settings object being null. If this happens, reparse it BEFORE we start.

        // And I would've got away with it too, if it weren't for
        // you meddling jsx-no-lambda rule!
        let opt = [];
        [0,1,2,3,4].forEach(ele => opt.push(<option value={ele}>{ele}</option>));

        // Dynamically generating size units too, since it avoids having 4 massive lambdas in the return brick. This isn't much better syntactically, but the alternative
        // is the below block, repeated 4 times.
        let sizeOpt = [];
        ["KB", "MB", "GB", "TB"].forEach(ele => sizeOpt.push(<option value={ele}>{ele}</option>)); 

        // We also need to dynamically generate the element for the user management pane, since it's not only prone to errors but also needs to wait for a fetch.
        var userManagementTable;
        if(this.state.userList === undefined){
            userManagementTable = (<h1 id='userManagementPlaceholderLoadingText'>Retrieving users from server. Please wait...</h1>);
        } else if(this.state.userList === null){
            userManagementTable = (<h1 id='userManagementPlaceholderLoadingText'>Error retrieving users from server. Please reload.</h1>);
        } else {

            // Before we start, we need to dynamically generate the options for a user's class, since we can't modify any user who's higher then us, nor
            // can we set somebody to a higher level then us.
            let classOptions = [];
            for(const [k, v] of Object.entries(USER_CLASSES)){
                if(v <= USER_CLASSES[localStorage.getItem('usrClass')]){
                    classOptions.push(<option value={k}>{k}</option>);
                }
            }

            let users = [];
            this.state.userList.forEach(ele => {
                // There are three different conditions here: Either the element we're operating on is the current user, the element we're operating has more permissions then us, or 
                // the element we're operating on has <= permissions and as such we can modify it. We also need to choose the class options such that we ca
                var tabler;
                if(ele.username === localStorage.getItem('username')){
                    tabler = (<tr className='userManagementEntry'><td><p style={{textAlign: 'left'}}>{ele.username}</p></td><td><p>Current User</p></td><td>Last login: {this.formatTimestamp(ele.lastlogin)}</td><td><p>Current user, cannot modify or delete.</p></td></tr>);
                } else if(USER_CLASSES[ele.class] > USER_CLASSES[localStorage.getItem('usrClass')]){
                    tabler = (<tr className='userManagementEntry'><td><p style={{textAlign: 'left'}}>{ele.username}</p></td><td><p>Higher Privilege</p></td><td>Last login: {this.formatTimestamp(ele.lastlogin)}</td><td><p>{ele.username} has higher privileges then you, modification prohibited.</p></td></tr>);
                } else {
                    // I was going to keep this as a gigantic one-liner but it's got too many functional parts to do that, especially the edit menu. TODO simplify this, it's bloated and hard to read.
                    tabler = (<tr className='userManagementEntry'>
                            <td><p style={{textAlign: 'left'}}>{ele.username}</p></td>
                            <td><select id={'classSwitch'+ele.username} value={ele.class} onChange={this.onUserClassChange}>{classOptions}</select></td>
                            <td>Last login: {this.formatTimestamp(ele.lastlogin)}</td>
                            <td><div className='flexHorizontal'>
                                <button className='userDeleteButton' id={'userDel'+ele.username} onClick={this.onUserDelete}>Delete</button>
                                <div className={this.state.editUserDropdown === ele.username ? 'userEditPane userEditPaneActive' : 'userEditPane'} id={'userEdit'+ele.username} onClick={this.state.editUserDropdown !== ele.username ? this.onUserEditClick : undefined}>
                                    {
                                        // Nothing like some hacky CSS for a minor animation! UX comes first. FIXME clarity.
                                    }
                                    {this.state.editUserDropdown === ele.username ?
                                        <div className='flexHorizontal'>
                                        <button className='userChangeDetailButton' id='changeOtherUsername' onClick={this.launchNewUserWizard}>Username...</button>
                                        <div style={{height: '1px', minWidth: '10px'}} />
                                        <button className='userChangeDetailButton' id='changeOtherPassword' onClick={this.launchNewUserWizard}>Password...</button>
                                        </div>
                                        :
                                        'Edit...'
                                    }
                                </div>
                                </div>
                            </td>
                        </tr>);
                }
                users.push(tabler);
            });

            userManagementTable = (
                <table className='userManagementTable' cellSpacing={0}>
                    <tbody>
                        {users}
                    </tbody>
                </table>
            );
        }

        return (
            <div className='settings'>
                <div className='settingsContent'>
                    <div className='settingsContainer'>
                        <div className='settingsTitleSubtitle'>
                            <div id="userSettingsHeader">
                                <h1>User Settings</h1>
                                <div className={this.state.shouldSavingBeVisible ? 'userSettingsSavedNotification' : 'userSettingsSavedNotification hidden'}>Saving...</div>
                            </div>
                            <h2>// Appearance and personal settings</h2>
                        </div>
                        <div className='settingIndividual'>
                            <h2>Storage Display Units</h2>
                            <select id='storageDisplayUnitSelect' value={this.state.settings.strDplUnits} onChange={this.onSettingsUpdate}>
                                {sizeOpt} 
                            </select>
                        </div>
                        <div className='settingIndividual'>
                            <h2>Storage Display Accuracy (Decimal Places)</h2>
                            <select id='storageDisplayAccuracySelect' value={this.state.settings.strAcc} onChange={this.onSettingsUpdate}>
                                {opt}
                            </select>
                        </div>
                        <div className='settingIndividual'>
                            <h2>Authorized Discord Account</h2>
                            <input type='text' onChange={this.onDiscordAccEdit} className={this.state.discordAccSaveInProgress === 0 ? 'discordAccEntry' : this.state.discordAccSaveInProgress === 1 ? 'discordAccEntry discordAccEntryCooldown' : 'discordAccEntry discordAccEntryFinished'} value={this.state.authorizedDiscordAcc} />
                        </div>
                        <div className='settingIndividual'>
                            <h2>Change Password</h2>
                            <button id='changeOwnPassword' onClick={this.launchNewUserWizard}>Change Password...</button>
                        </div>
                    </div>
                    {(USER_CLASSES[localStorage.getItem('usrClass')] >= USER_CLASSES['ADMINISTRATOR']) ?
                        <div className='settingsContainer'>
                            <div className='settingsContainerHeader'>
                                <div className='settingsTitleSubtitle'>
                                    <h1>User Management</h1>
                                    {
                                    // eslint-disable-next-line
                                    <h2>// Administrator Settings</h2>
                                    }
                                </div>
                                <hr />
                                <button id='newUserLaunch' onClick={this.launchNewUserWizard}>New User</button>
                            </div>
                        {userManagementTable}
                    </div> : null
                    }
                </div>
                <div className={this.state.currentUserDetailChangeDialog === 'newUser' ? 'dialogBoxContainer' : 'dialogBoxContainer hidden'}>
                    <div className='settingsContainer'>
                        <h1>ADMIN // User Management // New User</h1>
                        <form id='newUser' onSubmit={this.onNewUserFormSubmit}>
                            <label>Username</label>
                            <input type='text' id='username' value={this.state.newUser.username} onChange={this.onNewUserFormChange} />
                            <label>Password</label>
                            <input type='password' id='password' value={this.state.newUser.password} onChange={this.onNewUserFormChange} />
                            <div className='flexHorizontal'>
                                <button id='newUserCancel' type='button' onClick={this.onNewUserFormCancel}>Cancel</button>
                                <hr />
                                <input type='submit' id='newUserCreate' disabled={!this.state.shouldSubmitBeClickable} value='create' />
                            </div>
                        </form>
                    </div>
                </div>
                <div className={this.state.currentUserDetailChangeDialog === 'changeUsername' ? 'dialogBoxContainer' : 'dialogBoxContainer hidden'}>
                    <div className='settingsContainer'>
                        <h1>ADMIN // User Management // Change Username</h1>
                        <h2>// Current Username: {this.state.editUserDropdown}</h2>
                        <form id='newUser' onSubmit={this.onNewUserFormSubmit}>
                            <label>New Username</label>
                            <input type='text' id='username' value={this.state.changeUsername.username} onChange={this.onNewUserFormChange} />
                            <label>Confirm New Username</label>
                            <input type='text' id='confirmUser' value={this.state.changeUsername.confirmUser} onChange={this.onNewUserFormChange} />
                            <div className='flexHorizontal'>
                                <button id='newUserCancel' type='button' onClick={this.onNewUserFormCancel}>Cancel</button>
                                <hr />
                                <input type='submit' id='newUserCreate' disabled={!this.state.shouldSubmitBeClickable} value='Change' />
                            </div>
                        </form>
                    </div>
                </div>
                <div className={this.state.currentUserDetailChangeDialog === 'changeOtherPass' ? 'dialogBoxContainer' : 'dialogBoxContainer hidden'}>
                    <div className='settingsContainer'>
                        <h1>ADMIN // User Management // Change Password</h1>
                        <h2>// Changing password for user '{this.state.editUserDropdown}'</h2>
                        <form id='newUser' onSubmit={this.onNewUserFormSubmit}>
                            <label>New Password</label>
                            <input type='password' id='password' value={this.state.changeOtherPass.password} onChange={this.onNewUserFormChange} />
                            <label>Confirm New Password</label>
                            <input type='password' id='confirmPass' value={this.state.changeOtherPass.confirmPass} onChange={this.onNewUserFormChange} />
                            <div className='flexHorizontal'>
                                <button id='newUserCancel' type='button' onClick={this.onNewUserFormCancel}>Cancel</button>
                                <hr />
                                <input type='submit' id='newUserCreate' disabled={!this.state.shouldSubmitBeClickable} value='Change' />
                            </div>
                        </form>
                    </div>
                </div>
                <div className={this.state.currentUserDetailChangeDialog === 'changeOwnPass' ? 'dialogBoxContainer' : 'dialogBoxContainer hidden'}>
                    <div className='settingsContainer'>
                        <h1>User Settings // Change Password</h1>
                        <h2>// You will be logged out automatically upon clicking 'Change'.</h2>
                        <form id='newUser' onSubmit={this.onNewUserFormSubmit}>
                            <label>Old Password</label>
                            <input type='password' id='oldPassword' value={this.state.changeOwnPass.oldPassword} onChange={this.onNewUserFormChange} />
                            <label>New Password</label>
                            <input type='password' id='password' value={this.state.changeOwnPass.password} onChange={this.onNewUserFormChange} />
                            <label>Confirm New Password</label>
                            <input type='password' id='confirmPass' value={this.state.changeOwnPass.confirmPass} onChange={this.onNewUserFormChange} />
                            <div className='flexHorizontal'>
                                <button id='newUserCancel' type='button' onClick={this.onNewUserFormCancel}>Cancel</button>
                                <hr />
                                <input type='submit' id='newUserCreate' disabled={!this.state.shouldSubmitBeClickable} value='Change' />
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )
    }
}

export default Settings;