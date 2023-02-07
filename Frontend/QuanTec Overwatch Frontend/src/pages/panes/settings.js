import React from 'react';
import { SERVER_IP } from './masterAPIAddress';
import './settings.css';
import './UserClassHeirarchy.js';
import { USER_CLASSES } from './UserClassHeirarchy.js';

class Settings extends React.Component {

    constructor(props){
        super(props);
        
        this.state = {
            settings: JSON.parse(localStorage.getItem('usrSettings')),
            userList: undefined,
            shouldSavingBeVisible: false,
            shouldNewUserDialogBeVisible: false,
            newUserForm: {
                username: "",
                password: ""
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
        
        // This fetch is admin-only, so we need to check it before we get the userlist, otherwise it fills the console with errors since the API will return 403.
        if(USER_CLASSES[localStorage.getItem('usrClass')] >= USER_CLASSES['ADMINISTRATOR']){
            fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'GETALLUSERS'})).catch(
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
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'UPDATEUSERSETTINGS\n'+JSON.stringify(this.state.settings)})).then(
            res => {
                // Response received, hide the 'saving' message.
                this.setState({shouldSavingBeVisible: false});
            }
        );
    }

    launchNewUserWizard(){
        this.setState({shouldNewUserDialogBeVisible: true});
    }

    onNewUserFormChange(event){
        let mutated = this.state.newUserForm;
        mutated[event.target.id] = event.target.value;

        this.setState({
            newUserForm: mutated,
        })
    }

    onNewUserFormCancel(event){
        // Cancel clicked, erase form and add 'hidden' attribute back to the dialog box.
        this.setState({
            shouldNewUserDialogBeVisible: false,
            newUserForm: {
                username: "",
                password: ""
            }
        });
    }

    onNewUserFormSubmit(event){
        event.preventDefault();
        event.target.enabled = false;

        // Send new details in POST to API. Since the server might throw an error here, there needs to be handling for it (e.g. a user can try to make a user with a duplicate name, which will return 400.)
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'NEWUSER\n'+this.state.newUserForm.username+'\n'+this.state.newUserForm.password})).then(
            res => {
                if(res.status !== 204){
                    alert('Server returned '+res.status+'. Please try again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                } else {
                    // Fetch new user list and shove it into state, which should make the render method show our changes.
                    fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'GETALLUSERS'})).catch(
                        NetworkError => this.setState({userList: null})
                    ).then(
                        res => {return res.json();}
                    ).then(
                        res => this.setState({
                            userList: res.users,
                            shouldNewUserDialogBeVisible: false,
                            newUserForm: {
                                username: "",
                                password: ""
                            }
                        })
                    ); 
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
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'SETUSERCLASS\n'+username+'\n'+userClass})).then(
            res => {
                if(res.status !== 204){
                    alert("Server returned "+res.status+'. Please try again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                } else {
                    // Fetch username list again and let setState redraw the table.
                    fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'GETALLUSERS'})).catch(
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
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'DELETEUSER\n'+username})).then(
            res => {
                if(res.status !== 204){
                    alert("Server returned "+res.status+'. Please try again. THIS MESSAGE IS A PLACEHOLDER, AND WILL BE REPLACED SHORTLY.');
                } else {
                    // Fetch username list again and let setState redraw the table.
                    fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', headers: {Authorization: 'Bearer '+localStorage.getItem('btkn')}, body: 'GETALLUSERS'})).catch(
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
                    tabler = (<tr className='userManagementEntry'><td><p style={{textAlign: 'left'}}>{ele.username}</p></td><td><p>Current User</p></td><td>Last login: {this.formatTimestamp(ele.lastlogin)}</td><td><p>Current user, cannot change permissions/delete.</p></td></tr>);
                } else if(USER_CLASSES[ele.class] > USER_CLASSES[localStorage.getItem('usrClass')]){
                    tabler = (<tr className='userManagementEntry'><td><p style={{textAlign: 'left'}}>{ele.username}</p></td><td><p>Higher Privilege</p></td><td>Last login: {this.formatTimestamp(ele.lastlogin)}</td><td><p>{ele.username} has higher privileges then you, cannot change permissions/delete.</p></td></tr>);
                } else {
                    tabler = (<tr className='userManagementEntry'><td><p style={{textAlign: 'left'}}>{ele.username}</p></td><td><select id={'classSwitch'+ele.username} value={ele.class} onChange={this.onUserClassChange}>{classOptions}</select></td><td>Last login: {this.formatTimestamp(ele.lastlogin)}</td><td><button className='userDeleteButton' id={'userDel'+ele.username} onClick={this.onUserDelete}>Delete</button></td></tr>);
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
                        <div id="userSettingsHeader">
                            <h1>User Settings</h1>
                            <div className={this.state.shouldSavingBeVisible ? 'userSettingsSavedNotification' : 'userSettingsSavedNotification hidden'}>Saving...</div>
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
                <div className={this.state.shouldNewUserDialogBeVisible ? 'dialogBoxContainer' : 'dialogBoxContainer hidden'}>
                    <div className='settingsContainer'>
                        <h1>ADMIN // User Management // New User</h1>
                        <form id='newUser' onSubmit={this.onNewUserFormSubmit}>
                            <label>Username</label>
                            <input type='text' id='username' value={this.state.newUserForm.username} onChange={this.onNewUserFormChange} />
                            <label>Password</label>
                            <input type='password' id='password' value={this.state.newUserForm.password} onChange={this.onNewUserFormChange} />
                            <div className='flexHorizontal'>
                                <button id='newUserCancel' type='button' onClick={this.onNewUserFormCancel}>Cancel</button>
                                <hr />
                                <input type='submit' id='newUserCreate' value='create' />
                            </div>
                        </form>
                    </div>
                </div>
                
            </div>
        )
    }
}

export default Settings;