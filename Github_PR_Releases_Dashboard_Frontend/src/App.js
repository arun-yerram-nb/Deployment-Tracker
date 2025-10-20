// App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import UserPrsDashboard from "./components/UserPrsDashboard";
import UserReleasesDashboard from "./components/UserReleasesDashboard";
import "bootstrap/dist/css/bootstrap.min.css";
import { Spinner, Container } from "react-bootstrap";

const API_BASE = "http://127.0.0.1:5000/api";

function App() {
  const [allUsers, setAllUsers] = useState([]);
  const [repoList, setRepoList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsersAndRepos = async () => {
      try {
        const [usersRes, reposRes] = await Promise.all([
          fetch(`${API_BASE}/people`),
          fetch(`${API_BASE}/repos`)
        ]);

        const usersData = await usersRes.json();
        const reposData = await reposRes.json();

        if (usersRes.ok && Array.isArray(usersData.people)) setAllUsers(usersData.people);
        if (reposRes.ok && Array.isArray(reposData.repos)) setRepoList(reposData.repos);
      } catch (err) {
        console.error("Failed to fetch users or repos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndRepos();
  }, []);

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" />
      </Container>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<UserPrsDashboard allUsers={allUsers} repoList={repoList} />}
        />
        <Route
          path="/releases-dashboard"
          element={<UserReleasesDashboard allUsers={allUsers} repoList={repoList} />}
        />
      </Routes>
    </Router>
  );
}

export default App;
