import './Login.css';
import React from 'react';
import {withRouter} from './withRouter';
import { SERVER_IP } from './panes/masterAPIAddress';
import { sanitizePassword } from './panes/passwordSanitizer.ts';

class Login extends React.Component {

  constructor(props){
    super(props);
    
    this.state = {
      username: "",
      password: "",
      submit_text: "Login",
      submitted: false,
      submit_button_classes: "submit",
      login: "",
      // STOPSHIP change back to https!!!
      referralReason: !window.location.toString().startsWith('http://') ? (<h1><span style={{color: 'red', backgroundColor: 'white'}}>WARNING: THIS BROWSER IS NOT USING HTTPS. DO NOT ENTER YOUR PASSWORD!</span></h1>) : localStorage.getItem('kickoutReferralReason'),
      shouldShowReferralReason: localStorage.getItem('kickoutReferralReason') !== null || !window.location.toString().startsWith('http://'),
      referralReasonLocked: !window.location.toString().startsWith('http://'),
      failedLogins: 0,
      killScreen: false
    }

    this.successful = false;

    this.onFormChange = this.onFormChange.bind(this);
    this.onFormSubmit = this.onFormSubmit.bind(this);
  }

  componentDidMount(){
    // Once we're mounted, check for query parameters. If one is 'error', set the referral reason to an
    // appropriate message (Login with x failed, please try again) and erase session storage. If a valid one
    // exists, set the state of the login form to stop it from double-sending, then try to login to the server.
    const params = new URLSearchParams(window.location.search);

    if(params.get('error') !== null){
      if(!this.state.referralReasonLocked){
        this.setState({
          referralReason: 'Login through Discord failed, please try again.',
          shouldShowReferralReason: true,
        });
      } else {
        alert('Login with Discord failed. Please try manually logging in. Params.error = '+params.get('error'));
      }
    } else if(params.get('code') !== null){
      if(sessionStorage.getItem('id') !== params.get('state')){
        // CSRF/Clickjacking, respond in an appropriate and civil manner.
        this.setState({killScreen: true});
        localStorage.clear();
        sessionStorage.clear();
      } else {
        // State matches and we've got the code, send a custom login request to the auth endpoint.
        fetch(new Request(SERVER_IP+'auth', {method: 'POST', mode: 'cors', body: JSON.stringify({code: params.get('code'), method: 'discord'})})).then(res => {
          if(res.status !== 200){
            // Denied, unlock form, reset sessionStorage and continue.
            sessionStorage.clear();
            const failedLogins = this.state.failedLogins + 1;
            this.setState({
              submit_text: "Access Denied",
              submit_button_classes: "submit incorrect",
              failedLogins: failedLogins
            });

            if(failedLogins > 2){
              this.setState({
                killScreen: true,
                shouldShowReferralReason: false,
                referralReasonLocked: false
              });
            }

            setTimeout(() => this.setState({submit_button_classes: "submit", submit_text: "Login", submitted: false}), 3000);
          } else {
            // Compute JSON of response.
            return res.json();
          }
        }).then(
          res => {
            if(res !== undefined){
              // Same as regular login, though with a 'username' field.
              localStorage.setItem('btkn', res.token);
              localStorage.setItem('username', res.username);
              localStorage.removeItem('kickoutReferralReason');
              sessionStorage.clear();
              this.props.navigate('/console');
            }
          }
        );
      }
    }
  }

  onFormChange(event){

    // Sanity checks. If username is now blank, set its BG color to red and add a hint. Do the same for password.

    if(event.target.value === ""){
      event.target.className = event.target.className + " incorrect";
    } else {
      event.target.className = event.target.className.substring(0,event.target.className.indexOf(' '));
    }

    this.setState({
      [event.target.id]: event.target.value,
      shouldShowReferralReason: false
    })
  }

  onLoad(res){

    if(res.status === 401){
      // Incorrect details.
      const failedLogins = this.state.failedLogins + 1;
      this.setState({
        submit_text: "Access Denied",
        submit_button_classes: "submit incorrect",
        failedLogins: failedLogins
      });

      if(failedLogins > 2){
        this.setState({
          killScreen: true,
          shouldShowReferralReason: false,
          referralReasonLocked: false
        });
      }

      setTimeout(() => this.setState({submit_button_classes: "submit", submit_text: "Login", submitted: false}), 3000);

      return undefined;
    } else if(res.status === 403) {
      this.setState({
        killScreen: true,
        shouldShowReferralReason: false,
        referralReasonLocked: false
      });
    } else if(res.status === 200){
      // Authenticated successfully, set flag so that onData() can link to /console
      this.successful = true;
      return res.json();
    }

    this.setState({
        submit_text: res.status,
    });

    if(res.status !== 200){
      this.error_encountered = true;
    }
  }

  onData(data){
    if(data !== undefined && this.successful){
      localStorage.setItem("btkn", data.token);
      localStorage.setItem("username", this.state.username);
      localStorage.removeItem('kickoutReferralReason');
      sessionStorage.clear(); // Only used once, here.
      this.props.navigate("/console");
    } 
  }

  onFormSubmit(event){
    this.setState({
      submit_text: "Please wait...",
      submitted: true,
    });

    let details = {
      username: this.state.username,
      password: sanitizePassword(this.state.password)
    }

    // Manually form login credentials temporarily, as setState isn't instant (We still set it here to make use of it later, after we've confirmed it's valid).

    const request = new Request(SERVER_IP+'auth', {method: "POST", mode: "cors", body: JSON.stringify(details)});
    fetch(request).catch(NetworkError => {
      this.setState({
        submit_text: 'Server Error',
        submit_button_classes: "submit incorrect"
      });
      setTimeout(() => this.setState({submit_button_classes: "submit", submit_text: "Login", submitted: false}), 3000)    
    }).then(
      (response) => this.onLoad(response)
    ).then(
      (blob) => this.onData(blob)
    );
    this.error_encountered = false;

    event.preventDefault();
  }

  render() {

    return (
      <div className="container">
        <div className={this.state.killScreen ? 'App disabled' : "App"}>
          <h1 id="title">QuanTec Overwatch</h1>
          <form id="login" onSubmit={this.onFormSubmit}>
            <label className="loginfield">Username</label>
            <input type="text" id="username" value={this.state.username} onChange={this.onFormChange} />
            <label className="loginfield">Password</label>
            <input type="password" id="password" value={this.state.password} onChange={this.onFormChange} />
            <input type="submit" className={this.state.submit_button_classes} value={this.state.submit_text} disabled={this.state.submitted || this.state.password === '' || this.state.username === ''} />
          </form>
          <button className='discordOAuthLaunch' onClick={() => {
            var id = '';
            for(var i = 0; i < 64; i++){
              id += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.length));
            }
            sessionStorage.setItem('id', id);
            // FIXME change back!
            window.location.href = 'https://discord.com/oauth2/authorize?response_type=code&client_id=1075308298049437726&scope=identify%20guilds&state=' + id + '&redirect_uri=http%3A%2F%2Flocalhost:3000&prompt=consent'; // '&redirect_uri=https%3A%2F%2Fthegaff.dev&prompt=consent'
            }}>
              {
                <div style={{height: '100%', width: '15%'}} className='flexHorizontal' dangerouslySetInnerHTML={{__html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36"><defs><style>.cls-1{fill:#fff;}</style></defs><g id="图层_2" data-name="图层 2"><g id="Discord_Logos" data-name="Discord Logos"><g id="Discord_Logo_-_Large_-_White" data-name="Discord Logo - Large - White"><path class="cls-1" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></g></g></g></svg>'}} />
              }
              <p style={{paddingLeft: '7.5px'}}>Login with Discord</p></button>
        </div>
        <video preload='true' autoPlay={this.state.killScreen} loop='true' className={this.state.killScreen ? null : 'disabled'}>
          <source src="https://cdn.discordapp.com/attachments/802032518421151774/1071296286675959849/theKing.mp4" type="video/mp4" />
          LOCKOUT TRIGGERED
        </video> 
        {(this.state.shouldShowReferralReason || this.state.referralReasonLocked) ? 
          <div className='loginReferralReason'>
            <p>{this.state.referralReason === 'badResponseFromServer' ? 'You were logged out. Please log in again.' : this.state.referralReason}</p>
          </div>  
        : null
        }
      </div>
    );
  }
}

export default withRouter(Login);
