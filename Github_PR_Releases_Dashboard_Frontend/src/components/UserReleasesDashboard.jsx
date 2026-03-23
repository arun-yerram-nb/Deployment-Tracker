import React, { useEffect, useRef, useState } from "react";
import {
  Form,
  Row,
  Col,
  Table,
  Spinner,
  Pagination,
} from "react-bootstrap";
import { useTheme } from "../ThemeContext";

const API_BASE = "http://127.0.0.1:5000/api";

const UserReleasesDashboard = () => {
  const { darkMode } = useTheme();

  const [username, setUsername] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [tagSearch, setTagSearch] = useState("");
  const [repoSearchTable, setRepoSearchTable] = useState("");

  const [allReleases, setAllReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [displayedReleases, setDisplayedReleases] = useState([]);

  const [allUsers, setAllUsers] = useState([]);
  const [allRepos, setAllRepos] = useState([]);
  const [allTags, setAllTags] = useState([]);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Refs for dropdown detection
  const repoDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  const tagDropdownRef = useRef(null);

  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target))setShowRepoDropdown(false);
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) setShowUserDropdown(false);
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target))setShowTagDropdown(false);
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
        fetch("/release_tags.json")
          .then((res) => res.json())
          .then(setAllTags)
          .catch(() => setAllTags([]));
      }, []);

    useEffect(() => {
      const fetchReleases = async () => {
        setLoading(true);
        try{
          const res = await fetch(`${API_BASE}/user-releases`);
          const data = await res.json();
          setAllReleases(data.items || []);
        }catch(err){
          console.error(err);
          setAllReleases([]);
        }finally{
          setLoading(false);
        }
    };    fetchReleases();
    }, []);

    useEffect(() => {
      let data = [...allReleases];

      if (repoSearchTable.trim())data = data.filter((r) => (r.repo_name || "").toLowerCase().includes(repoSearchTable.trim().toLowerCase()));
      if (username.trim())data = data.filter((r) => (r.author || "").toLowerCase().includes(username.trim().toLowerCase()));
      if (tagSearch.trim())data = data.filter((r) => (r.tag_name || "").toLowerCase().includes(tagSearch.trim().toLowerCase()));
      if (fromDate)data = data.filter((r) => new Date(r.created_at) >= new Date(fromDate));
      if (toDate)data = data.filter((r) => new Date(r.created_at) <= new Date(toDate));

      if (sortConfig.key) {
        data.sort((a, b) => {
          let valA = a[sortConfig.key] || "";
          let valB = b[sortConfig.key] || "";
          if (sortConfig.key === "created_at") {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
          } else {
            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();
          }
          if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
          if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        });
      }
      setFilteredReleases(data);
      setDisplayedReleases(data.slice(0, perPage));
      setPage(1);
    }, [allReleases, tagSearch, repoSearchTable, username, fromDate, toDate, sortConfig]);

    const handlePageChange = (pageNumber) => {
      setPage(pageNumber);
      const start = (pageNumber - 1) * perPage;
      setDisplayedReleases(filteredReleases.slice(start, start + perPage));
    };

    const totalPages = Math.max(1, Math.ceil(filteredReleases.length / perPage));
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
      <h2 className="text-center mb-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>GitHub Release Dashboard</h2>
      <Form>
        <Row className="align-items-center mb-2">

          {/* user autocomplete */}
          <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Username"
              value={username}
              onChange={(e) => {setUsername(e.target.value); setShowUserDropdown(true); }}
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
          
          <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Tag"
              value={tagSearch}
              onChange={(e) => {setTagSearch(e.target.value); setShowTagDropdown(true); }}
              onFocus={() => setShowTagDropdown(true)}
              style={formControlStyle}
            />
              {showTagDropdown && (
                <div className="dropdown-menu show w-100" style={dropdownStyle}>
                {allTags.filter((name) =>
                    name.toLowerCase().includes(tagSearch.toLowerCase())
                  ).map((name, idx) => (
                    <div 
                      key={idx}
                    className="dropdown-item"
                    onClick={() => {
                      setTagSearch(name);
                      setShowTagDropdown(false);
                    }}
                  style={{  ...formControlStyle, cursor: "pointer"}}>
                      {name}
                    </div>
                  ))}
                </div>
              )}
          </Col>
          </Row>

        <Row className="mb-3">
          <Col md={3}>
            <Form.Control
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={formControlStyle}
            />
          </Col>
          <Col md={3}>
            <Form.Control
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={formControlStyle}
            />
          </Col>
        </Row>
      </Form>
      

      {loading ? (
        <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
          <Spinner animation="border" style={{ color: darkMode ? "#61dafb" : "#007bff" }} />
        </div>
      ) : displayedReleases.length ? (
        <>
          <Table 
            striped 
            bordered 
            hover 
            responsive 
            className={`mt-3 ${darkMode ? "table-dark" : "table-light"}`}
            style={{
              backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
              color: darkMode ? "#ffffff" : "#000000"
            }}
          >
            <thead className={darkMode ? "table-dark" : "table-light"} style={{ backgroundColor: darkMode ? "#121212" : "#f8f9fa" }}>

              <tr>
                <th onClick={() => handleSort("tag_name")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Name / Tag
                </th>
                <th onClick={() => handleSort("repo_name")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Repo
                </th>
                <th onClick={() => handleSort("author")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Author
                </th>
                <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Created At
                </th>
              
              </tr>
            </thead>

            <tbody>
              {displayedReleases.map((r) => (
                <tr key={r.id || r.tag_name} style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}>

                  {/* 🔗 Title as hyperlink */}
                  <td>
                    <a href={r.html_url} target="_blank" rel="noreferrer" style={{ color: darkMode ? "#61dafb" : "#007bff", textDecoration: "none" }}>
                      {r.name || r.tag_name}
                    </a>
                  </td>

                  <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{r.repo_name}</td>
                  <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{r.author}</td>
                  <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination className="justify-content-center">
            <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
            <Pagination.Prev
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            />
            {getPageNumbers().map((p) => (
              <Pagination.Item
              key={p} active={p === page} onClick={() => handlePageChange(p)} style={{ backgroundColor: p === page ? (darkMode ? "#61dafb" : "#007bff") : "transparent", color: darkMode ? "#ffffff" : "#000000", }}
              >
                {p} 
              </Pagination.Item>
            ))}
             
            <Pagination.Next
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            />
            <Pagination.Last
              onClick={() => handlePageChange(totalPages)}
              disabled={page === totalPages}
            />
          </Pagination>
        </>
      ) : (
        <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>No releases found</div>
      )}
    </div>
  );
};

export default UserReleasesDashboard;