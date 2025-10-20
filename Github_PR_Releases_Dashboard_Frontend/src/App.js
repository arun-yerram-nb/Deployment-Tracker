import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import UserPrsDashboard from "./components/UserPrsDashboard";
import UserReleasesDashboard from "./components/UserReleasesDashboard";
import ReleaseTagsDashboard from "./components/ReleaseTagsDashboard";
import axios from "axios";
import { Navbar, Nav, Container } from "react-bootstrap";

const API_BASE = "http://127.0.0.1:5000/api";

const App = () => {
  const [repoList, setRepoList] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await axios.get(`${API_BASE}/repos`);
        setRepoList(res.data.repos || []);
      } catch (error) {
        console.error("Error fetching repos:", error);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/people`);
        setAllUsers(res.data.people || []);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    const fetchTags = async () => {
      try {
        const res = await axios.get(`${API_BASE}/all-tags`);
        setAllTags(res.data.tags || []);
      } catch (error) {
        console.error("Error fetching release tags:", error);
      }
    };

    fetchRepos();
    fetchUsers();
    fetchTags();
  }, []);

  return (
    <Router>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">PRs Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/releases">Releases Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/release-tags">Release Tags</Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <Routes>
          <Route 
            path="/" 
            element={<UserPrsDashboard repoList={repoList} allUsers={allUsers} />} 
          />
          <Route 
            path="/releases" 
            element={<UserReleasesDashboard repoList={repoList} allUsers={allUsers} />} 
          />
          <Route
            path="/release-tags"
            element={<ReleaseTagsDashboard tags={allTags} />}
          />
        </Routes>
      </Container>
    </Router>
  );
};

export default App;
