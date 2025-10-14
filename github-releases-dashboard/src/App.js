// App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import UserPrsDashboard from "./components/UserPrsDashboard";
import "bootstrap/dist/css/bootstrap.min.css";
import UserReleasesDashboard from "./components/UserReleasesDashboard";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserPrsDashboard />} />
        <Route path="/releases-dashboard" element={<UserReleasesDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

