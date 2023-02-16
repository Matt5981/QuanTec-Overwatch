import Login from './pages/Login';
import Console from './pages/Console';
import React from 'react';
import {Routes, Route, useParams} from 'react-router-dom';
function App() {
    return (
      <Routes>
        <Route exact path="/" element={<Login params={useParams()} />} />
        <Route exact path="/console" element={<Console />} />
      </Routes>
      );
}

export default App;
