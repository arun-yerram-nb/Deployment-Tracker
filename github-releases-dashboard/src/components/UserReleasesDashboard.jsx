import React, { useEffect, useState } from "react";
import { Form, Button, Row, Col, Table, Spinner } from "react-bootstrap";

const API_BASE = "http://127.0.0.1:5000/api";

const UserReleasesDashboard = () => {
  const [username, setUsername] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [releases, setReleases] = useState([]);
  const [repoList, setRepoList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch igloo* repos for dropdown
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await fetch(`${API_BASE}/repos`);
        const data = await res.json();
        if (res.ok) setRepoList(data.repos || []);
      } catch (err) {
        console.error("Failed to fetch repos:", err);
      }
    };
    fetchRepos();
  }, []);

  // Fetch releases based on username and/or repo
  const fetchReleases = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/user-releases?`;
      if (username.trim()) url += `username=${username.trim()}&`;
      if (selectedRepo) url += `repo=${selectedRepo}&`;

      const res = await fetch(url);
      const data = await res.json();
      setReleases(data.items || []);
    } catch (err) {
      console.error(err);
      setReleases([]);
    }
    setLoading(false);
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">GitHub Release Dashboard</h2>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          fetchReleases();
        }}
        className="mb-3"
      >
        <Row>
          <Col md={4}>
            <Form.Control
              placeholder="GitHub Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Col>
          <Col md={4}>
            <Form.Select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
            >
              <option value="">All Repos</option>
              {repoList.map((r, idx) => (
                <option key={idx} value={r}>
                  {r}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md="auto">
            <Button type="submit">Search</Button>
          </Col>
        </Row>
      </Form>

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : releases.length > 0 ? (
        <Table striped bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th>Name / Tag</th>
              <th>Repo</th>
              <th>Created At</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((r, idx) => (
              <tr key={`${r.repo_name}-${r.tag_name}-${idx}`}>
                <td>{r.name || r.tag_name}</td>
                <td>{r.repo_name}</td>
                <td>
                  {r.created_at
                    ? new Date(r.created_at).toLocaleString()
                    : "-"}
                </td>
                <td>
                  <a href={r.html_url} target="_blank" rel="noreferrer">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="text-center py-4">No releases found</div>
      )}
    </div>
  );
};

export default UserReleasesDashboard;
