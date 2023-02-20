import './Console.css';
import React from 'react';
import {withRouter} from './withRouter.js';
import { Navigate } from 'react-router-dom';
import Dashboard from './panes/dashboard';
import Quantec from './panes/quantec';
import Settings from './panes/settings';
import Logout from './panes/logout';
import { SERVER_IP } from './panes/masterAPIAddress';

class Console extends React.Component {

    constructor(props){
        super(props);

        this.state = {
            active: 'dashboard',
            kill: false,
            settingsFetchSuccess: false,
            dashboard: new Dashboard(props),

        };

        // Get user settings. We'll overwrite the local copy of the settings if present, since the server copy overrides this one.
        // As we're using cookies for auth, this also serves as the first check as to whether we're authenticated or not.
        fetch(new Request(SERVER_IP, {method: 'POST', mode: 'cors', credentials: 'include', body: 'GETUSERSETTINGS'}))
        .then(res => {
            if(res.status !== 200){
                this.setState({
                    kill: true,
                })
            } else {
                return res.json();
            }
        }).then(
            res => {
                // Save to local storage. TODO is it neccessary to do this here, or can the body string be done outside of a second promise?
                localStorage.setItem('usrSettings', JSON.stringify(res.userSettings));
                localStorage.setItem('usrClass', res.userClass);
                this.setState({
                    settingsFetchSuccess: true
                });
            }
        );
        
        this.onMenuButtonClick = this.onMenuButtonClick.bind(this);
        this.kill = this.kill.bind(this);
    }

    onMenuButtonClick(event){
        this.setState({
            active: event.target.id, 
        });
    }

    kill(){
        this.setState({kill: true});
    }

    render(){

        if(this.state.kill){
            return <Navigate to='/' replace={true} />
        }

        if(!this.state.settingsFetchSuccess){
            return (<div className='loadingScreen'>
                <img src='https://cdn.discordapp.com/attachments/802032518421151774/1058233332627931156/quan.png' id='loadingQuan' alt='the Quan'/>
                <h1>Retrieving data from API, please wait...</h1>
            </div>);
        }

        return (
            <div className='container_console'>
                <div className='rightMenuContainer'>
                    <div id='usernameBar'>
                        <img src='https://cdn.discordapp.com/attachments/802032518421151774/1058233332627931156/quan.png' id='usernameBarImage' alt='the Vince' />
                        <div className='usernameContainer'>
                            <h1 id='rightMenuUsername'>{localStorage.getItem('username')}</h1>
                            <h1 id='rightMenuClass'>{localStorage.getItem('usrClass')}</h1>
                        </div>
                    </div>
                    <div className='rightMenu'>
                        <button id='dashboard' className={this.state.active === 'dashboard' ? 'menuButton current' : 'menuButton'} onClick={this.onMenuButtonClick}>Dashboard</button>
                        <button id='quantec' className={this.state.active === 'quantec' ? 'menuButton current' : 'menuButton'} onClick={this.onMenuButtonClick}>QuanTec</button>
                        <button id='settings' className={this.state.active === 'settings' ? 'menuButton current' : 'menuButton'} onClick={this.onMenuButtonClick}>Settings</button>
                        <button id='logout' className={this.state.active === 'logout' ? 'menuButton current' : 'menuButton'} onClick={this.onMenuButtonClick}>Log Out</button>
                    </div>
                </div>
            
                <div className='contentContainer'>
                    <Dashboard enabled={this.state.active === 'dashboard'} killPtr={this.kill} />
                    <Quantec enabled={this.state.active === 'quantec'} />
                    <Settings enabled={this.state.active === 'settings'} />
                    <Logout enabled={this.state.active === 'logout'} />
                </div>
            </div>
        );
    }
}

export default withRouter(Console);