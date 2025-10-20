import React, { useEffect, useRef, useState } from "react";
import { Form, Button, Row, Col, Table, Spinner, Pagination } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";

const API_BASE = "http://127.0.0.1:5000/api";

const UserReleasesDashboard = ({ allUsers: initialUsers = [], repoList: initialRepos = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState(localStorage.getItem("rel_username") || "");
  const [userSearch, setUserSearch] = useState(localStorage.getItem("rel_userSearch") || "");
  const [allUsers, setAllUsers] = useState(initialUsers);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [selectedRepo, setSelectedRepo] = useState(localStorage.getItem("rel_selectedRepo") || "");
  const [repoList, setRepoList] = useState(initialRepos);
  const [repoSearch, setRepoSearch] = useState(localStorage.getItem("rel_repoSearch") || "");
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  const [allReleases, setAllReleases] = useState(JSON.parse(localStorage.getItem("rel_data")) || []);
  const [displayedReleases, setDisplayedReleases] = useState(JSON.parse(localStorage.getItem("rel_displayed")) || []);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(Number(localStorage.getItem("rel_page")) || 1);
  const [perPage] = useState(10);

  const [fromDate, setFromDate] = useState(localStorage.getItem("rel_fromDate") || "");
  const [toDate, setToDate] = useState(localStorage.getItem("rel_toDate") || "");

  const userDropdownRef = useRef(null);
  const repoDropdownRef = useRef(null);

  // -------------------- FETCH USERS & REPOS ONCE --------------------
  useEffect(() => {
    const fetchUsersAndRepos = async () => {
      try {
        // Users
        if (!allUsers.length) {
          const cachedUsers = JSON.parse(sessionStorage.getItem("allUsers") || "[]");
          if (cachedUsers.length) {
            setAllUsers(cachedUsers);
          } else {
            const resUsers = await fetch(`${API_BASE}/people`);
            const dataUsers = await resUsers.json();
            if (resUsers.ok && Array.isArray(dataUsers.people)) {
              setAllUsers(dataUsers.people);
              sessionStorage.setItem("allUsers", JSON.stringify(dataUsers.people));
            }
          }
        }

        // Repos
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
  }, []);

  // -------------------- OUTSIDE CLICK TO CLOSE DROPDOWNS --------------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) setShowUserDropdown(false);
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target)) setShowRepoDropdown(false);
    };
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, []);

  // -------------------- FILTER USERS & REPOS --------------------
  const filteredUsers = allUsers.filter(u => u.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const filteredRepos = repoList.filter(r => r.toLowerCase().includes(repoSearch.trim().toLowerCase()));

  // -------------------- FETCH RELEASES --------------------
  const fetchReleases = async (usernameToFetch = username) => {
    setLoading(true);
    try {
      let url = `${API_BASE}/user-releases?per_page=2000&`;
      if (usernameToFetch.trim()) url += `username=${encodeURIComponent(usernameToFetch.trim())}&`;
      if (selectedRepo) url += `repo=${encodeURIComponent(selectedRepo)}&`;

      const res = await fetch(url);
      const data = await res.json();
      let items = data.items || [];

      // Date filter
      if (fromDate || toDate) {
        items = items.filter(r => {
          const created = new Date(r.created_at);
          let valid = true;
          if (fromDate) valid = valid && (created >= new Date(fromDate));
          if (toDate) valid = valid && (created <= new Date(toDate));
          return valid;
        });
      }

      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setAllReleases(items);
      setPage(1);
      setDisplayedReleases(items.slice(0, perPage));

      // Save to localStorage
      localStorage.setItem("rel_username", usernameToFetch);
      localStorage.setItem("rel_userSearch", userSearch);
      localStorage.setItem("rel_selectedRepo", selectedRepo);
      localStorage.setItem("rel_repoSearch", repoSearch);
      localStorage.setItem("rel_fromDate", fromDate);
      localStorage.setItem("rel_toDate", toDate);
      localStorage.setItem("rel_data", JSON.stringify(items));
      localStorage.setItem("rel_displayed", JSON.stringify(items.slice(0, perPage)));
      localStorage.setItem("rel_page", 1);
    } catch (err) {
      console.error(err);
      setAllReleases([]);
      setDisplayedReleases([]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------- HANDLERS --------------------
  const handleSearch = (e) => {
    e.preventDefault();
    const userToFetch = userSearch.trim();
    if (userToFetch) {
      setUsername(userToFetch);
      navigate({ pathname: "/releases", search: `?username=${encodeURIComponent(userToFetch)}` }, { replace: true });
      fetchReleases(userToFetch);
    } else {
      setUsername("");
      navigate({ pathname: "/releases" }, { replace: true });
      fetchReleases("");
    }
  };

  const handlePageChange = (pageNumber) => {
    setPage(pageNumber);
    const start = (pageNumber - 1) * perPage;
    const slice = allReleases.slice(start, start + perPage);
    setDisplayedReleases(slice);
    localStorage.setItem("rel_displayed", JSON.stringify(slice));
    localStorage.setItem("rel_page", pageNumber);
  };

  const handleSelectUser = (user) => { setUsername(user); setUserSearch(user); setShowUserDropdown(false); };
  const handleClearUser = () => { setUsername(""); setUserSearch(""); setShowUserDropdown(false); };
  const handleSelectRepo = (repo) => { setSelectedRepo(repo); setRepoSearch(repo); setShowRepoDropdown(false); };
  const handleClearRepo = () => { setSelectedRepo(""); setRepoSearch(""); setShowRepoDropdown(false); };

  const totalPages = Math.max(1, Math.ceil(allReleases.length / perPage));
  const getPageNumbers = () => {
    const maxVisible = 7;
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
      <h2 className="text-center mb-4">GitHub Release Dashboard</h2>

      <Form onSubmit={handleSearch} className="mb-3">
        <Row className="align-items-center">
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

      {loading ? (
        <div className="text-center py-4"><Spinner animation="border" /></div>
      ) : displayedReleases.length > 0 ? (
        <>
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr><th>Name / Tag</th><th>Repo</th><th>Created At</th><th>Link</th></tr>
            </thead>
            <tbody>
              {displayedReleases.map((r, idx) => (
                <tr key={`${r.repo_name}-${r.tag_name}-${idx}`}>
                  <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.tag_name}</td>
                  <td>{r.repo_name}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                  <td><a href={r.html_url} target="_blank" rel="noreferrer">View</a></td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="d-flex justify-content-center">
            <Pagination>
              <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
              <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
              {getPageNumbers()[0] > 1 && <Pagination.Ellipsis disabled />}
              {getPageNumbers().map((p) => (
                <Pagination.Item key={p} active={p === page} onClick={() => handlePageChange(p)}>{p}</Pagination.Item>
              ))}
              {getPageNumbers().slice(-1)[0] < totalPages && <Pagination.Ellipsis disabled />}
              <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
              <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
            </Pagination>
          </div>

          <div className="text-center mt-2" style={{ fontSize: 13, color: "#666" }}>
            Showing page {page} of {totalPages} — {allReleases.length} releases
          </div>
        </>
      ) : (
        <div className="text-center py-4">No releases found</div>
      )}
    </div>
  );
};

export default UserReleasesDashboard;

