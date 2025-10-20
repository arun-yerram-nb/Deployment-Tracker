
import React, { useEffect, useRef, useState } from "react";
import { Form, Button, Row, Col, Pagination, Table, Spinner } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";

const API_BASE = "http://127.0.0.1:5000/api";

const UserPrsDashboard = ({ allUsers: initialUsers = [], repoList: initialRepos = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState(localStorage.getItem("pr_username") || "");
  const [userSearch, setUserSearch] = useState(localStorage.getItem("pr_userSearch") || "");
  const [allUsers, setAllUsers] = useState(initialUsers);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [selectedRepo, setSelectedRepo] = useState(localStorage.getItem("pr_selectedRepo") || "");
  const [repoList, setRepoList] = useState(initialRepos);
  const [repoSearch, setRepoSearch] = useState(localStorage.getItem("pr_repoSearch") || "");
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  const [fromDate, setFromDate] = useState(localStorage.getItem("pr_fromDate") || "");
  const [toDate, setToDate] = useState(localStorage.getItem("pr_toDate") || "");

  const [page, setPage] = useState(Number(localStorage.getItem("pr_page")) || 1);
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(Number(localStorage.getItem("pr_totalCount")) || 0);
  const [prs, setPrs] = useState(JSON.parse(localStorage.getItem("pr_data")) || []);
  const [loading, setLoading] = useState(false);

  const userDropdownRef = useRef(null);
  const repoDropdownRef = useRef(null);

  // -------------------- FETCH USERS & REPOS ONCE --------------------
  useEffect(() => {
    const fetchUsersAndRepos = async () => {
      try {
        // Fetch users if state empty
        if (!allUsers.length) {
          const cachedPeople = JSON.parse(sessionStorage.getItem("allUsers") || "[]");
          if (cachedPeople.length) {
            setAllUsers(cachedPeople);
          } else {
            const resUsers = await fetch(`${API_BASE}/people`);
            const dataUsers = await resUsers.json();
            if (resUsers.ok && Array.isArray(dataUsers.people)) {
              setAllUsers(dataUsers.people);
              sessionStorage.setItem("allUsers", JSON.stringify(dataUsers.people));
            }
          }
        }

        // Fetch repos if state empty
        if (!repoList.length) {
          const cachedRepos = JSON.parse(sessionStorage.getItem("repoList") || "[]");
          if (cachedRepos.length) {
            setRepoList(cachedRepos);
          } else {
            const resRepos = await fetch(`${API_BASE}/repos`);
            const dataRepos = await resRepos.json();
            if (resRepos.ok && Array.isArray(dataRepos.repos)) {
              setRepoList(dataRepos.repos);
              sessionStorage.setItem("repoList", JSON.stringify(dataRepos.repos));
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch users/repos:", err);
      }
    };

    fetchUsersAndRepos();
  }, []); // run only once

  // -------------------- OUTSIDE CLICK TO CLOSE DROPDOWNS --------------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) setShowUserDropdown(false);
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target)) setShowRepoDropdown(false);
    };
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, []);

  // -------------------- FILTER USERS & REPOS FOR DROPDOWN --------------------
  const filteredUsers = allUsers.filter(u => u.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const filteredRepos = repoList.filter(r => r.toLowerCase().includes(repoSearch.trim().toLowerCase()));

  // -------------------- FETCH PRs --------------------
  const fetchPRs = async (pageNum = 1, usernameToFetch = username) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (usernameToFetch) params.append("username", usernameToFetch);
      if (selectedRepo) params.append("repo", selectedRepo);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      params.append("page", pageNum);
      params.append("per_page", perPage);

      const res = await fetch(`${API_BASE}/prs/all?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setPrs(data.items || []);
        setTotalCount(data.total_count || 0);
        setPage(data.page || 1);

        // Save state to localStorage
        localStorage.setItem("pr_username", usernameToFetch);
        localStorage.setItem("pr_userSearch", userSearch);
        localStorage.setItem("pr_selectedRepo", selectedRepo);
        localStorage.setItem("pr_repoSearch", repoSearch);
        localStorage.setItem("pr_fromDate", fromDate);
        localStorage.setItem("pr_toDate", toDate);
        localStorage.setItem("pr_page", data.page || 1);
        localStorage.setItem("pr_totalCount", data.total_count || 0);
        localStorage.setItem("pr_data", JSON.stringify(data.items || []));
      } else {
        console.error("Error fetching PRs:", data.error);
        setPrs([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error("Failed to fetch PRs:", err);
      setPrs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // -------------------- HANDLERS --------------------
  const handleSearch = (e) => {
    e?.preventDefault();
    const userToFetch = userSearch.trim();

    if (userToFetch) {
      setUsername(userToFetch);
      navigate({ pathname: "/", search: `?username=${encodeURIComponent(userToFetch)}` }, { replace: true });
      fetchPRs(1, userToFetch);
    } else {
      setUsername("");
      navigate({ pathname: "/" }, { replace: true });
      fetchPRs(1, "");
    }
  };

  const handlePageChange = (pageNum) => { fetchPRs(pageNum); };
  const handleSelectUser = (user) => { setUsername(user); setUserSearch(user); setShowUserDropdown(false); };
  const handleClearUser = () => { setUsername(""); setUserSearch(""); setShowUserDropdown(false); };
  const handleSelectRepo = (repo) => { setSelectedRepo(repo); setRepoSearch(repo); setShowRepoDropdown(false); };
  const handleClearRepo = () => { setSelectedRepo(""); setRepoSearch(""); setShowRepoDropdown(false); };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const getPageNumbers = () => {
    const maxVisible = 10;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // -------------------- RENDER --------------------
  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">GitHub PR Dashboard</h2>

      <Row className="align-items-center mb-3">
        <Col md={12}>
          <Form onSubmit={handleSearch}>
            <Row className="g-3 align-items-center">
              <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
                <Form.Control
                  placeholder="Search or Select GitHub username..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUsername(""); setShowUserDropdown(true); }}
                  onFocus={() => setShowUserDropdown(true)}
                />
                {showUserDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 220, overflowY: "auto", background: "white", border: "1px solid rgba(0,0,0,.15)", borderRadius: 4, zIndex: 1000 }}>
                    <div style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={handleClearUser}><strong>All Users</strong></div>
                    {filteredUsers.length === 0 ? (<div style={{ padding: "8px 10px", color: "#666" }}>No matches</div>) : filteredUsers.map((u, idx) => (
                      <div key={u + "-" + idx} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={() => handleSelectUser(u)}>{u}</div>
                    ))}
                  </div>
                )}
              </Col>

              <Col md={3} ref={repoDropdownRef} style={{ position: "relative" }}>
                <Form.Control
                  placeholder="Search or Select repo..."
                  value={repoSearch}
                  onChange={(e) => { setRepoSearch(e.target.value); setSelectedRepo(""); setShowRepoDropdown(true); }}
                  onFocus={() => setShowRepoDropdown(true)}
                />
                {showRepoDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 220, overflowY: "auto", background: "white", border: "1px solid rgba(0,0,0,.15)", borderRadius: 4, zIndex: 1000 }}>
                    <div style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={handleClearRepo}><strong>All Repos</strong></div>
                    {filteredRepos.length === 0 ? (<div style={{ padding: "8px 10px", color: "#666" }}>No matches</div>) : filteredRepos.map((r, idx) => (
                      <div key={r + "-" + idx} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={() => handleSelectRepo(r)}>{r}</div>
                    ))}
                  </div>
                )}
              </Col>

              <Col md={2}><Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Col>
              <Col md={2}><Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></Col>
              <Col md="auto"><Button type="submit">Search</Button></Col>
            </Row>
          </Form>
        </Col>
      </Row>

      {loading ? (
        <div className="text-center"><Spinner animation="border" /></div>
      ) : prs.length === 0 ? (
        <div className="text-center">No PRs found</div>
      ) : (
        <>
          <Table striped bordered hover responsive>
            <thead>
              <tr><th>Title</th><th>Number</th><th>Repo</th><th>State</th><th>Created At</th></tr>
            </thead>
            <tbody>
              {prs.map(pr => (
                <tr key={pr.html_url}>
                  <td><a href={pr.html_url} target="_blank" rel="noreferrer">{pr.title}</a></td>
                  <td>{pr.number}</td>
                  <td>{pr.repo_name}</td>
                  <td>{pr.state}</td>
                  <td>{new Date(pr.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {totalCount > perPage &&
            <Pagination className="mt-3">
              <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
              <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
              {getPageNumbers().map(p => (
                <Pagination.Item key={p} active={page === p} onClick={() => handlePageChange(p)}>{p}</Pagination.Item>
              ))}
              <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
              <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
            </Pagination>
          }
        </>
      )}
    </div>
  );
};

export default UserPrsDashboard;




