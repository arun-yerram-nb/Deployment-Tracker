import React, { useEffect, useRef, useState } from "react";
import { Form, Row, Col, Table, Spinner, Pagination, Badge } from "react-bootstrap";
import { useTheme } from "../ThemeContext";

const API_BASE = "http://127.0.0.1:5000/api";

const UserPrsDashboard = () => {
  const { darkMode } = useTheme();

  const [username, setUsername] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [repoSearchTable, setRepoSearchTable] = useState("");
  const [stateSearch, setStateSearch] = useState("");

  const [allPrs, setAllPrs] = useState([]);
  const [filteredPrs, setFilteredPrs] = useState([]);
  const [displayedPrs, setDisplayedPrs] = useState([]);

  const [allUsers, setAllUsers] = useState([]);
  const [allRepos, setAllRepos] = useState([]);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const repoDropdownRef = useRef(null);
  const stateDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target)) setShowRepoDropdown(false);
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target)) setShowStateDropdown(false);
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) setShowUserDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch("/user_names.json")
      .then((res) => res.json())
      .then(setAllUsers)
      .catch(() => setAllUsers([]));
    fetch("/repo_names.json")
      .then((res) => res.json())
      .then(setAllRepos)
      .catch(() => setAllRepos([]));
  }, []);

  useEffect(() => {
    const fetchPRs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/user-prs`);
        const data = await res.json();
        setAllPrs(data.items || []);
      } catch (err) {
        console.error(err);
        setAllPrs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPRs();
  }, []);

  useEffect(() => {
    let data = [...allPrs];

    if (username.trim()) data = data.filter((pr) => (pr.author || "").toLowerCase().includes(username.trim().toLowerCase()));
    if (repoSearchTable.trim()) data = data.filter((pr) => (pr.repo_name || "").toLowerCase().includes(repoSearchTable.trim().toLowerCase()));
    if (stateSearch.trim()) data = data.filter((pr) => (pr.state || "").toLowerCase().includes(stateSearch.trim().toLowerCase()));
    if (fromDate) data = data.filter((pr) => new Date(pr.created_at) >= new Date(fromDate));
    if (toDate) data = data.filter((pr) => new Date(pr.created_at) <= new Date(toDate));

    if (sortConfig.key) {
      data.sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        if (sortConfig.key === "created_at") {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }
        else if (sortConfig.key === "pr_age_days") {
      valA = valA ?? 0;
      valB = valB ?? 0;} 
        else {
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();
        }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFilteredPrs(data);
    setDisplayedPrs(data.slice(0, perPage));
    setPage(1);
  }, [allPrs, username, repoSearchTable, stateSearch, fromDate, toDate, sortConfig]);

  const handlePageChange = (pageNumber) => {
    setPage(pageNumber);
    const start = (pageNumber - 1) * perPage;
    setDisplayedPrs(filteredPrs.slice(start, start + perPage));
  };

  const totalPages = Math.max(1, Math.ceil(filteredPrs.length / perPage));
  const getPageNumbers = () => {
    const maxVisible = 7;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const formControlStyle = {
    backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
    color: darkMode ? "#ffffff" : "#000000",
    borderColor: darkMode ? "#444444" : "#dee2e6",
  };

  const dropdownStyle = {
    backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
    color: darkMode ? "#ffffff" : "#000000",
    maxHeight: 150,
    overflowY: "auto",
  };

  return (
    <div className="container mt-4" style={{ backgroundColor: darkMode ? "#121212" : "#ffffff" }}>
      <h2 className="text-center mb-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
        GitHub Pull Request Dashboard
      </h2>
      <Form>
        <Row className="align-items-center mb-2">

          <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setShowUserDropdown(true); }}
              onFocus={() => setShowUserDropdown(true)}
              style={formControlStyle}
            />
            {showUserDropdown && (
              <div className="dropdown-menu show w-100" style={dropdownStyle}>
                {allUsers
                  .filter((u) => u.toLowerCase().includes(username.toLowerCase()))
                  .map((u, idx) => (
                    <div
                      key={idx}
                      className="dropdown-item"
                      onClick={() => { setUsername(u); setShowUserDropdown(false); }}
                      style={{ ...formControlStyle, cursor: "pointer" }}
                    >
                      {u}
                    </div>
                  ))}
              </div>
            )}
          </Col>

          <Col md={3} ref={repoDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Repo"
              value={repoSearchTable}
              onChange={(e) => { setRepoSearchTable(e.target.value); setShowRepoDropdown(true); }}
              onFocus={() => setShowRepoDropdown(true)}
              style={formControlStyle}
            />
            {showRepoDropdown && (
              <div className="dropdown-menu show w-100" style={dropdownStyle}>
                {allRepos
                  .filter((r) => r.toLowerCase().includes(repoSearchTable.toLowerCase()))
                  .map((r, idx) => (
                    <div
                      key={idx}
                      className="dropdown-item"
                      onClick={() => { setRepoSearchTable(r); setShowRepoDropdown(false); }}
                      style={{ ...formControlStyle, cursor: "pointer" }}
                    >
                      {r}
                    </div>
                  ))}
              </div>
            )}
          </Col>

          <Col md={3} ref={stateDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by State"
              value={stateSearch}
              onChange={(e) => {setStateSearch(e.target.value); setShowStateDropdown(true); }}
              onFocus={() => setShowStateDropdown(true)}
              style={formControlStyle}
            />
            {showStateDropdown && (
              <div className="dropdown-menu show w-100" style={dropdownStyle}>
                {Array.from(new Set(allPrs.map((p) => p.state)))
                  .filter((st) => st && st.toLowerCase().includes(stateSearch.toLowerCase()))
                  .map((st, idx) => (
                    <div
                      key={idx}
                      className="dropdown-item"
                      onClick={() => { setStateSearch(st); setShowStateDropdown(false); }}
                      style={{ ...formControlStyle, cursor: "pointer" }}
                    >
                      {st}
                    </div>
                  ))}
              </div>
            )}
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={3}>
            <Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={formControlStyle} />
          </Col>
          <Col md={3}>
            <Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={formControlStyle} />
          </Col>
        </Row>
      </Form>

      {loading ? (
        <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
          <Spinner animation="border" style={{ color: darkMode ? "#61dafb" : "#007bff" }} />
        </div>
      ) : displayedPrs.length ? (
        <>
          <Table
            striped bordered hover responsive
            className={`mt-3 ${darkMode ? "table-dark" : "table-light"}`}
            style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}
          >
            <thead
              className={darkMode ? "table-dark" : "table-light"}
              style={{ backgroundColor: darkMode ? "#121212" : "#f8f9fa" }}
            >
              <tr>
                <th onClick={() => handleSort("title")} style={{ cursor: "pointer" }}>Title</th>
                {/* ✅ Jira column — after Title */}
               
                <th onClick={() => handleSort("repo_name")} style={{ cursor: "pointer" }}>Repo</th>
                <th onClick={() => handleSort("state")} style={{ cursor: "pointer" }}>State</th>
                <th onClick={() => handleSort("author")} style={{ cursor: "pointer" }}>Author</th>
                <th>Reviewers</th>
                <th>Approvers</th>
                 <th>Jira</th>
                <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer" }}>Created At</th>
                {/* <th onClick={() => handleSort("age_days")} style={{ cursor: "pointer" }}>Age (days)</th> */}
                <th onClick={() => handleSort("pr_age_days")} style={{ cursor: "pointer" }}>Age (days)</th>
              </tr>
            </thead>

            <tbody>
              {displayedPrs.map((p, idx) => (
                <tr key={p.id || idx} style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}>

                  {/* Title */}
                  <td>
                    <a href={p.html_url} target="_blank" rel="noreferrer"
                      style={{ color: darkMode ? "#61dafb" : "#007bff", textDecoration: "none" }}>
                      {p.title}
                    </a>
                  </td>

                  {/* Repo */}
                  <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{p.repo_name}</td>

                  {/* State */}
                  <td>
                    <Badge bg={
                      p.state === "open" ? "success" :
                      p.state === "merged" ? "primary" :
                      p.state === "closed" ? "danger" : "secondary"
                    }>
                      {p.state}
                    </Badge>
                  </td>

                  {/* Author */}
                  <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{p.author}</td>

                  {/* Reviewers */}
                  <td>
                    {p.requested_reviewers?.length ? (
                      p.requested_reviewers.map((r, i) => (
                        <Badge key={i} bg="info" text={darkMode ? "light" : "dark"} className="me-1">{r}</Badge>
                      ))
                    ) : (
                      <span style={{ color: darkMode ? "#b0b0b0" : "#666666" }}>-</span>
                    )}
                  </td>

                  {/* Approvers */}
                  <td>
                    {p.approvers?.length ? (
                      p.approvers.map((r, i) => (
                        <Badge key={i} bg="success" text="light" className="me-1">{r}</Badge>
                      ))
                    ) : (
                      <span style={{ color: darkMode ? "#b0b0b0" : "#666666" }}>-</span>
                    )}
                  </td>

                  {/* ✅ Jira */}
                  <td>
                    {p.jira_url ? (
                      <a href={p.jira_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                        <Badge bg="warning" text="dark" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {p.jira_key}
                        </Badge>
                      </a>
                    ) : (
                      <span style={{ color: darkMode ? "#b0b0b0" : "#999999" }}>—</span>
                    )}
                  </td>

                  {/* Created At */}
                  <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>
                    {new Date(p.created_at).toLocaleString()}
                  </td>

                  {/* <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>
                    {(p.age_days)}
                  </td> */}

                         <td>
  {p.pr_age_days !== null && p.pr_age_days !== undefined ? (
    <Badge bg={
      p.pr_age_days <= 7 ? "success" :
      p.pr_age_days <= 14 ? "warning" :
      "danger"
    }>
      {p.pr_age_days}
    </Badge>
  ) : "-"}
</td>
 

                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination className="justify-content-center">
            <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
            <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
            {getPageNumbers().map((p) => (
              <Pagination.Item
                key={p} active={p === page} onClick={() => handlePageChange(p)}
                style={{
                  backgroundColor: p === page ? (darkMode ? "#61dafb" : "#007bff") : "transparent",
                  color: darkMode ? "#ffffff" : "#000000",
                }}
              >
                {p}
              </Pagination.Item>
            ))}
            <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
            <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
          </Pagination>
        </>
      ) : (
        <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
          No pull requests found
        </div>
      )}
    </div>
  );
};

export default UserPrsDashboard;
