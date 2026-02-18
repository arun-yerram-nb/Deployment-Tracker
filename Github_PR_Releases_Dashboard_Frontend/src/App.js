import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import UserPrsDashboard from "./components/UserPrsDashboard";
import UserReleasesDashboard from "./components/UserReleasesDashboard";
// import ReleaseTagsDashboard from "./components/ReleaseTagsDashboard";
import axios from "axios";
import { Navbar, Nav, Container } from "react-bootstrap";

const API_BASE = "http://127.0.0.1:5000/api";

const App = () => {
  return (
    <Router>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">PRs Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/releases">Releases Dashboard</Nav.Link>
            {/* <Nav.Link as={Link} to="/release-tags">Release Tags</Nav.Link> */}
          </Nav>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <Routes>
          <Route
            path="/" 
            element={<UserPrsDashboard />} 
          />
          <Route 
            path="/releases" 
            element={<UserReleasesDashboard />} 
          />
          {/* <Route
            path="/release-tags"
            element={<ReleaseTagsDashboard />}
          /> */}
        </Routes>
      </Container>
    </Router>
  );
};

export default App;
