import Login from './pages/Login';
import Console from './pages/Console';
import React from 'react';
import {Routes, Route} from 'react-router-dom';
class App extends React.Component {
  render() {
    return (
      <Routes>
        <Route exact path="/" element={<Login />} />
        <Route exact path="/console" element={<Console />} />
      </Routes>
      );
  }
}

export default App;
