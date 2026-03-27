import React, { useEffect, useRef, useState } from "react";
import { Form, Row, Col, Table, Spinner, Pagination, Badge, Button, Modal } from "react-bootstrap";
import { useTheme } from "../ThemeContext";

const API_BASE = "http://127.0.0.1:5000/api";
const SPRINT_DAYS = 14;

// ─── Contributor Report helpers ───────────────────────────────────────────────

const getSprintRanges = () => {
  const now = new Date();
  const sub = (d, days) => { const x = new Date(d); x.setDate(x.getDate() - days); return x; };
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

  const lastEnd     = now;
  const lastStart   = sub(now, SPRINT_DAYS);
  const penEnd      = sub(now, SPRINT_DAYS);
  const penStart    = sub(now, SPRINT_DAYS * 2);
  const thirtyStart = sub(now, 30);

  return {
    last:   { start: lastStart,   end: lastEnd,  label: `LAST SPRINT (${fmt(lastStart)} – ${fmt(lastEnd)})` },
    penult: { start: penStart,    end: penEnd,   label: `PENULT SPRINT (${fmt(penStart)} – ${fmt(penEnd)})` },
    thirty: { start: thirtyStart, end: lastEnd,  label: `LAST 30 DAYS (${fmt(thirtyStart)} – ${fmt(lastEnd)})` },
  };
};

// ✅ Fixed: uses start-of-day / end-of-day to avoid boundary bleed between sprints
const inRange = (dateStr, start, end) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(end);   e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
};

// ✅ Fixed: all 3 metrics corrected
const buildReport = (prs, allUsers) => {
  const sprints = getSprintRanges();
  const users = {};

  // Pre-seed ALL known users from user_names.json so no one is missed
  allUsers.forEach((author) => {
    users[author] = {
      author,
      last:   { opened: 0, merged: 0, reviews: 0, commits: 0 },
      penult: { opened: 0, merged: 0, reviews: 0, commits: 0 },
      thirty: { opened: 0, merged: 0, reviews: 0, commits: 0 },
    };
  });

  const ensure = (author) => {
    if (!users[author]) {
      users[author] = {
        author,
        last:   { opened: 0, merged: 0, reviews: 0, commits: 0 },
        penult: { opened: 0, merged: 0, reviews: 0, commits: 0 },
        thirty: { opened: 0, merged: 0, reviews: 0, commits: 0 },
      };
    }
  };

  prs.forEach((pr) => {
    const author = pr.author;
    if (!author) return;
    ensure(author);

    ["last", "penult", "thirty"].forEach((key) => {
      const { start, end } = sprints[key];

      // ✅ PRs Opened: based on created_at
      if (inRange(pr.created_at, start, end)) {
        users[author][key].opened++;
      }

      // ✅ PRs Merged: state must be merged AND created_at in range
      // (no merged_at in API response, created_at is the safest proxy)
      if (pr.state === "merged" && inRange(pr.created_at, start, end)) {
        users[author][key].merged++;
      }
    });

    // ✅ Reviews: deduplicated with Set so no one is double-counted per PR
    const reviewerSet = new Set([
      ...(pr.requested_reviewers || []),
      ...(pr.approvers || []),
    ]);

    reviewerSet.forEach((reviewer) => {
      ensure(reviewer);
      ["last", "penult", "thirty"].forEach((key) => {
        const { start, end } = sprints[key];
        if (inRange(pr.created_at, start, end)) {
          users[reviewer][key].reviews++;
        }
      });
    });
  });

  return { users: Object.values(users), sprints };
};

const heatColor = (val) => {
  if (val === 0) return { bg: "#f0f0f0", color: "#aaa" };
  if (val <= 2)  return { bg: "#c8f5c8", color: "#2d7a2d" };
  if (val <= 5)  return { bg: "#fde68a", color: "#92400e" };
  return           { bg: "#fca5a5", color: "#991b1b" };
};

const HeatCell = ({ val, darkBg }) => {
  const { bg, color } = heatColor(val);
  return (
    <td style={{
      textAlign: "center",
      fontWeight: 600,
      fontSize: "0.85rem",
      backgroundColor: val === 0 ? (darkBg ? "#2a2a2a" : "#f8f8f8") : bg,
      color: val === 0 ? (darkBg ? "#555" : "#bbb") : color,
      border: "1px solid " + (darkBg ? "#333" : "#e5e7eb"),
    }}>
      {val}
    </td>
  );
};

// ─── Contributor Report Modal ─────────────────────────────────────────────────

const ContributorReport = ({ allPrs, allUsers, show, onHide, darkMode }) => {
  const { users, sprints } = buildReport(allPrs, allUsers);

  const generated = new Date().toLocaleString("en-US", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const totalContributors = users.length;
  const totalOpened30     = users.reduce((s, u) => s + u.thirty.opened,  0);
  const totalMerged30     = users.reduce((s, u) => s + u.thirty.merged,  0);
  const totalReviews30    = users.reduce((s, u) => s + u.thirty.reviews, 0);

  const bg     = darkMode ? "#121212" : "#ffffff";
  const card   = darkMode ? "#1e1e1e" : "#f0f6ff";
  const sub    = darkMode ? "#aaa"    : "#64748b";
  const hdr    = "#1a6dc7";
  const border = darkMode ? "#333"    : "#dbeafe";

  const thStyle = {
    backgroundColor: hdr,
    color: "#fff",
    textAlign: "center",
    fontSize: "0.78rem",
    fontWeight: 700,
    border: "1px solid #1558a8",
    padding: "6px 8px",
    whiteSpace: "nowrap",
  };

  const avatarUrl = (username) => `https://github.com/${username}.png?size=28`;

  return (
    <Modal show={show} onHide={onHide} size="xl" centered
      contentClassName={darkMode ? "bg-dark text-white" : ""}
    >
      <Modal.Body style={{ backgroundColor: bg, padding: 0 }}>

        {/* Header banner */}
        <div style={{
          backgroundColor: hdr,
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderRadius: "4px 4px 0 0",
        }}>
          <div style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700 }}>
            👥 Contributor Activity — NationsBenefits
          </div>
          <div style={{ color: "#cfe8ff", fontSize: "0.78rem", textAlign: "right" }}>
            Generated {generated}<br />
            Sprint = {SPRINT_DAYS} days
          </div>
        </div>

        <div style={{ padding: "20px 24px", backgroundColor: bg }}>

          {/* Summary stats */}
          <div style={{
            display: "flex", gap: 32, marginBottom: 20,
            padding: "14px 20px",
            backgroundColor: card,
            borderRadius: 8,
            border: `1px solid ${border}`,
          }}>
            {[
              { val: totalContributors, label: "CONTRIBUTORS"     },
              { val: totalOpened30,     label: "PRS OPENED (30D)" },
              { val: totalMerged30,     label: "PRS MERGED (30D)" },
              { val: totalReviews30,    label: "REVIEWS (30D)"    },
              { val: 0,                 label: "COMMITS (30D)"    },
            ].map(({ val, label }) => (
              <div key={label} style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: "1.7rem", fontWeight: 800, color: hdr }}>{val}</div>
                <div style={{ fontSize: "0.65rem", color: sub, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Heat legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center" }}>
            {[
              { bg: "#f0f0f0", label: "0"            },
              { bg: "#c8f5c8", label: "1–2 (low)"    },
              { bg: "#fde68a", label: "3–5 (medium)" },
              { bg: "#fca5a5", label: "6+ (high)"    },
            ].map(({ bg: b, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 14, backgroundColor: b, border: "1px solid #ccc", borderRadius: 2 }} />
                <span style={{ fontSize: "0.75rem", color: sub }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          {users.length === 0 ? (
            <div style={{ textAlign: "center", color: sub, padding: 32 }}>
              No contributor data available.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ ...thStyle, textAlign: "left", paddingLeft: 12, minWidth: 160 }}>
                      GITHUB USER
                    </th>
                    <th colSpan={4} style={thStyle}>
                      {sprints.last.label}
                    </th>
                    <th colSpan={4} style={{ ...thStyle, backgroundColor: "#e67e22", border: "1px solid #c0630e" }}>
                      {sprints.penult.label}
                    </th>
                    <th colSpan={4} style={{ ...thStyle, backgroundColor: "#f0c040", color: "#5a3e00", border: "1px solid #c9a030" }}>
                      {sprints.thirty.label}
                    </th>
                  </tr>
                  <tr>
                    {[
                      { label: "PRs Opened", bg: "#2a80d8", color: "#fff"    },
                      { label: "PRs Merged", bg: "#2a80d8", color: "#fff"    },
                      { label: "Reviews",    bg: "#2a80d8", color: "#fff"    },
                      { label: "Commits",    bg: "#2a80d8", color: "#fff"    },
                      { label: "PRs Opened", bg: "#d4873a", color: "#fff"    },
                      { label: "PRs Merged", bg: "#d4873a", color: "#fff"    },
                      { label: "Reviews",    bg: "#d4873a", color: "#fff"    },
                      { label: "Commits",    bg: "#d4873a", color: "#fff"    },
                      { label: "PRs Opened", bg: "#c9a030", color: "#5a3e00" },
                      { label: "PRs Merged", bg: "#c9a030", color: "#5a3e00" },
                      { label: "Reviews",    bg: "#c9a030", color: "#5a3e00" },
                      { label: "Commits",    bg: "#c9a030", color: "#5a3e00" },
                    ].map((h, i) => (
                      <th key={i} style={{ ...thStyle, backgroundColor: h.bg, color: h.color, fontSize: "0.72rem" }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <tr key={u.author} style={{
                      backgroundColor: idx % 2 === 0
                        ? (darkMode ? "#1a1a1a" : "#ffffff")
                        : (darkMode ? "#222"    : "#f8faff"),
                    }}>
                      <td style={{ padding: "7px 12px", borderBottom: `1px solid ${border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img
                            src={avatarUrl(u.author)}
                            alt={u.author}
                            width={24} height={24}
                            style={{ borderRadius: "50%", border: "1px solid #ccc" }}
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                          <a href={`https://github.com/${u.author}`} target="_blank" rel="noreferrer"
                            style={{ color: hdr, textDecoration: "none", fontWeight: 600 }}>
                            {u.author}
                          </a>
                        </div>
                      </td>
                      <HeatCell val={u.last.opened}    darkBg={darkMode} />
                      <HeatCell val={u.last.merged}    darkBg={darkMode} />
                      <HeatCell val={u.last.reviews}   darkBg={darkMode} />
                      <HeatCell val={u.last.commits}   darkBg={darkMode} />
                      <HeatCell val={u.penult.opened}  darkBg={darkMode} />
                      <HeatCell val={u.penult.merged}  darkBg={darkMode} />
                      <HeatCell val={u.penult.reviews} darkBg={darkMode} />
                      <HeatCell val={u.penult.commits} darkBg={darkMode} />
                      <HeatCell val={u.thirty.opened}  darkBg={darkMode} />
                      <HeatCell val={u.thirty.merged}  darkBg={darkMode} />
                      <HeatCell val={u.thirty.reviews} darkBg={darkMode} />
                      <HeatCell val={u.thirty.commits} darkBg={darkMode} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "right", marginTop: 12, fontSize: "0.72rem", color: sub }}>
            pr_contribs_report.py · {totalContributors} user(s) · org: NationsBenefits
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer style={{ backgroundColor: darkMode ? "#1a1a1a" : "#f8f9fa", borderTop: `1px solid ${border}` }}>
        <Button variant="secondary" size="sm" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const UserPrsDashboard = () => {
  const { darkMode } = useTheme();

  const [username,        setUsername]        = useState("");
  const [fromDate,        setFromDate]        = useState("");
  const [toDate,          setToDate]          = useState("");
  const [repoSearchTable, setRepoSearchTable] = useState("");
  const [stateSearch,     setStateSearch]     = useState("");

  const [podSearch,       setPodSearch]       = useState("");
  const [podMap,          setPodMap]          = useState({});
  const [showPodDropdown, setShowPodDropdown] = useState(false);
  const podDropdownRef = useRef(null);

  const [allPrs,       setAllPrs]       = useState([]);
  const [filteredPrs,  setFilteredPrs]  = useState([]);
  const [displayedPrs, setDisplayedPrs] = useState([]);
  const [allUsers,     setAllUsers]     = useState([]);
  const [allRepos,     setAllRepos]     = useState([]);

  const [loading,    setLoading]    = useState(false);
  const [page,       setPage]       = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [showReport, setShowReport] = useState(false);

  const perPage = 10;

  const repoDropdownRef  = useRef(null);
  const stateDropdownRef = useRef(null);
  const userDropdownRef  = useRef(null);

  const [showRepoDropdown,  setShowRepoDropdown]  = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showUserDropdown,  setShowUserDropdown]  = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (repoDropdownRef.current  && !repoDropdownRef.current.contains(event.target))  setShowRepoDropdown(false);
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target)) setShowStateDropdown(false);
      if (userDropdownRef.current  && !userDropdownRef.current.contains(event.target))  setShowUserDropdown(false);
      if (podDropdownRef.current   && !podDropdownRef.current.contains(event.target))   setShowPodDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch("/user_names.json").then((r) => r.json()).then(setAllUsers).catch(() => setAllUsers([]));
    fetch("/repo_names.json").then((r) => r.json()).then(setAllRepos).catch(() => setAllRepos([]));
    fetch("/pod_names.json").then((r) => r.json()).then(setPodMap).catch(() => setPodMap({}));
  }, []);

  useEffect(() => {
    const fetchPRs = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${API_BASE}/user-prs`);
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

    if (username.trim())        data = data.filter((pr) => (pr.author    || "").toLowerCase().includes(username.trim().toLowerCase()));
    if (repoSearchTable.trim()) data = data.filter((pr) => (pr.repo_name || "").toLowerCase().includes(repoSearchTable.trim().toLowerCase()));
    if (stateSearch.trim())     data = data.filter((pr) => (pr.state     || "").toLowerCase().includes(stateSearch.trim().toLowerCase()));
    if (fromDate) data = data.filter((pr) => new Date(pr.created_at) >= new Date(fromDate));
    if (toDate)   data = data.filter((pr) => new Date(pr.created_at) <= new Date(toDate));

    if (podSearch.trim() && podMap[podSearch]) {
      const svc = podMap[podSearch].map((s) => s.toLowerCase());
      data = data.filter((pr) => svc.includes((pr.repo_name || "").toLowerCase()));
    }

    if (sortConfig.key) {
      data.sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        if (sortConfig.key === "created_at")       { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
        else if (sortConfig.key === "pr_age_days") { valA = valA ?? 0; valB = valB ?? 0; }
        else                                       { valA = valA.toString().toLowerCase(); valB = valB.toString().toLowerCase(); }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ?  1 : -1;
        return 0;
      });
    }

    setFilteredPrs(data);
    setDisplayedPrs(data.slice(0, perPage));
    setPage(1);
  }, [allPrs, username, repoSearchTable, stateSearch, fromDate, toDate, sortConfig, podSearch, podMap]);

  const handlePageChange = (pageNumber) => {
    setPage(pageNumber);
    const start = (pageNumber - 1) * perPage;
    setDisplayedPrs(filteredPrs.slice(start, start + perPage));
  };

  const totalPages = Math.max(1, Math.ceil(filteredPrs.length / perPage));
  const getPageNumbers = () => {
    const maxVisible = 7;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end   = start + maxVisible - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const formControlStyle = {
    backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
    color:           darkMode ? "#ffffff" : "#000000",
    borderColor:     darkMode ? "#444444" : "#dee2e6",
  };

  const dropdownStyle = {
    backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
    color:           darkMode ? "#ffffff" : "#000000",
    maxHeight: 150,
    overflowY: "auto",
  };

  const filteredPodKeys = Object.keys(podMap).filter((k) =>
    k.toLowerCase().includes(podSearch.toLowerCase())
  );

  return (
    <div className="container mt-4" style={{ backgroundColor: darkMode ? "#121212" : "#ffffff" }}>

      {/* Title row with View Report button */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 style={{ color: darkMode ? "#ffffff" : "#000000", margin: 0 }}>
          GitHub Pull Request Dashboard
        </h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowReport(true)}
          style={{ fontWeight: 600, letterSpacing: "0.02em" }}
        >
          📊 View Report
        </Button>
      </div>

      <Form>
        <Row className="align-items-center mb-2">

          {/* POD */}
          <Col md={3} ref={podDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by POD"
              value={podSearch}
              onChange={(e) => { setPodSearch(e.target.value); setShowPodDropdown(true); }}
              onFocus={() => setShowPodDropdown(true)}
              style={formControlStyle}
            />
            {podSearch && (
              <span
                onClick={() => { setPodSearch(""); setShowPodDropdown(false); }}
                style={{
                  position: "absolute", right: 20, top: "50%",
                  transform: "translateY(-50%)", cursor: "pointer",
                  color: darkMode ? "#aaa" : "#666", fontWeight: "bold", zIndex: 10,
                }}
                title="Clear POD filter"
              >✕</span>
            )}
            {showPodDropdown && filteredPodKeys.length > 0 && (
              <div className="dropdown-menu show w-100" style={dropdownStyle}>
                {filteredPodKeys.map((key, idx) => (
                  <div key={idx} className="dropdown-item"
                    onClick={() => { setPodSearch(key); setShowPodDropdown(false); }}
                    style={{ ...formControlStyle, cursor: "pointer" }}>
                    {key}
                    <span style={{ fontSize: "0.75rem", color: darkMode ? "#aaa" : "#888", marginLeft: 6 }}>
                      ({podMap[key].length} services)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Col>

          {/* Username */}
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
                    <div key={idx} className="dropdown-item"
                      onClick={() => { setUsername(u); setShowUserDropdown(false); }}
                      style={{ ...formControlStyle, cursor: "pointer" }}>
                      {u}
                    </div>
                  ))}
              </div>
            )}
          </Col>

          {/* Repo */}
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
                    <div key={idx} className="dropdown-item"
                      onClick={() => { setRepoSearchTable(r); setShowRepoDropdown(false); }}
                      style={{ ...formControlStyle, cursor: "pointer" }}>
                      {r}
                    </div>
                  ))}
              </div>
            )}
          </Col>

          {/* State */}
          <Col md={3} ref={stateDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by State"
              value={stateSearch}
              onChange={(e) => { setStateSearch(e.target.value); setShowStateDropdown(true); }}
              onFocus={() => setShowStateDropdown(true)}
              style={formControlStyle}
            />
            {showStateDropdown && (
              <div className="dropdown-menu show w-100" style={dropdownStyle}>
                {Array.from(new Set(allPrs.map((p) => p.state)))
                  .filter((st) => st && st.toLowerCase().includes(stateSearch.toLowerCase()))
                  .map((st, idx) => (
                    <div key={idx} className="dropdown-item"
                      onClick={() => { setStateSearch(st); setShowStateDropdown(false); }}
                      style={{ ...formControlStyle, cursor: "pointer" }}>
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
          {podSearch && podMap[podSearch] && (
            <Col md={6} className="d-flex align-items-center">
              <Badge bg="purple" style={{ backgroundColor: "#6f42c1", fontSize: "0.85rem", padding: "6px 12px" }}>
                POD: {podSearch} — {podMap[podSearch].length} services
              </Badge>
            </Col>
          )}
        </Row>
      </Form>

      {loading ? (
        <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
          <Spinner animation="border" style={{ color: darkMode ? "#61dafb" : "#007bff" }} />
        </div>
      ) : displayedPrs.length ? (
        <>
          <Table striped bordered hover responsive
            className={`mt-3 ${darkMode ? "table-dark" : "table-light"}`}
            style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}
          >
            <thead className={darkMode ? "table-dark" : "table-light"}
              style={{ backgroundColor: darkMode ? "#121212" : "#f8f9fa" }}>
              <tr>
                <th onClick={() => handleSort("title")}       style={{ cursor: "pointer" }}>Title</th>
                <th onClick={() => handleSort("repo_name")}   style={{ cursor: "pointer" }}>Repo</th>
                <th onClick={() => handleSort("state")}       style={{ cursor: "pointer" }}>State</th>
                <th onClick={() => handleSort("author")}      style={{ cursor: "pointer" }}>Author</th>
                <th>Reviewers</th>
                <th>Approvers</th>
                <th>Jira</th>
                <th onClick={() => handleSort("created_at")}  style={{ cursor: "pointer" }}>Created At</th>
                <th onClick={() => handleSort("pr_age_days")} style={{ cursor: "pointer" }}>Age (days)</th>
              </tr>
            </thead>
            <tbody>
              {displayedPrs.map((p, idx) => (
                <tr key={p.id || idx} style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}>
                  <td>
                    <a href={p.html_url} target="_blank" rel="noreferrer"
                      style={{ color: darkMode ? "#61dafb" : "#007bff", textDecoration: "none" }}>
                      {p.title}
                    </a>
                  </td>
                  <td>{p.repo_name}</td>
                  <td>
                    <Badge bg={
                      p.state === "open"   ? "success" :
                      p.state === "merged" ? "primary" :
                      p.state === "closed" ? "danger"  : "secondary"
                    }>
                      {p.state}
                    </Badge>
                  </td>
                  <td>{p.author}</td>
                  <td>
                    {p.requested_reviewers?.length
                      ? p.requested_reviewers.map((r, i) => (
                          <Badge key={i} bg="info" text={darkMode ? "light" : "dark"} className="me-1">{r}</Badge>
                        ))
                      : <span style={{ color: darkMode ? "#b0b0b0" : "#666" }}>-</span>}
                  </td>
                  <td>
                    {p.approvers?.length
                      ? p.approvers.map((r, i) => (
                          <Badge key={i} bg="success" text="light" className="me-1">{r}</Badge>
                        ))
                      : <span style={{ color: darkMode ? "#b0b0b0" : "#666" }}>-</span>}
                  </td>
                  <td>
                    {p.jira_url
                      ? <a href={p.jira_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          <Badge bg="warning" text="dark" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                            {p.jira_key}
                          </Badge>
                        </a>
                      : <span style={{ color: darkMode ? "#b0b0b0" : "#999" }}>—</span>}
                  </td>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>
                    {p.pr_age_days != null
                      ? <Badge bg={
                          p.pr_age_days <= 7  ? "success" :
                          p.pr_age_days <= 14 ? "warning" : "danger"
                        }>{p.pr_age_days}</Badge>
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination className="justify-content-center">
            <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
            <Pagination.Prev  onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
            {getPageNumbers().map((p) => (
              <Pagination.Item key={p} active={p === page} onClick={() => handlePageChange(p)}
                style={{
                  backgroundColor: p === page ? (darkMode ? "#61dafb" : "#007bff") : "transparent",
                  color: darkMode ? "#ffffff" : "#000000",
                }}>
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

      {/* ✅ Contributor Report Modal */}
      <ContributorReport
        allPrs={allPrs}
        allUsers={allUsers}
        show={showReport}
        onHide={() => setShowReport(false)}
        darkMode={darkMode}
      />
    </div>
  );
};

export default UserPrsDashboard;


// import React, { useEffect, useRef, useState } from "react";
// import { Form, Row, Col, Table, Spinner, Pagination, Badge } from "react-bootstrap";
// import { useTheme } from "../ThemeContext";

// const API_BASE = "http://127.0.0.1:5000/api";

// const UserPrsDashboard = () => {
//   const { darkMode } = useTheme();

//   const [username, setUsername] = useState("");
//   const [fromDate, setFromDate] = useState("");
//   const [toDate, setToDate] = useState("");

//   const [repoSearchTable, setRepoSearchTable] = useState("");
//   const [stateSearch, setStateSearch] = useState("");

//   // ✅ POD state
//   const [podSearch, setPodSearch] = useState("");
//   const [podMap, setPodMap] = useState({});
//   const [showPodDropdown, setShowPodDropdown] = useState(false);
//   const podDropdownRef = useRef(null);

//   const [allPrs, setAllPrs] = useState([]);
//   const [filteredPrs, setFilteredPrs] = useState([]);
//   const [displayedPrs, setDisplayedPrs] = useState([]);

//   const [allUsers, setAllUsers] = useState([]);
//   const [allRepos, setAllRepos] = useState([]);

//   const [loading, setLoading] = useState(false);
//   const [page, setPage] = useState(1);
//   const perPage = 10;
//   const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

//   const repoDropdownRef = useRef(null);
//   const stateDropdownRef = useRef(null);
//   const userDropdownRef = useRef(null);

//   const [showRepoDropdown, setShowRepoDropdown] = useState(false);
//   const [showStateDropdown, setShowStateDropdown] = useState(false);
//   const [showUserDropdown, setShowUserDropdown] = useState(false);

//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target)) setShowRepoDropdown(false);
//       if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target)) setShowStateDropdown(false);
//       if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) setShowUserDropdown(false);
//       // ✅ Close POD dropdown on outside click
//       if (podDropdownRef.current && !podDropdownRef.current.contains(event.target)) setShowPodDropdown(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     fetch("/user_names.json")
//       .then((res) => res.json())
//       .then(setAllUsers)
//       .catch(() => setAllUsers([]));
//     fetch("/repo_names.json")
//       .then((res) => res.json())
//       .then(setAllRepos)
//       .catch(() => setAllRepos([]));
//     // ✅ Load POD map from JSON file
//     fetch("/pod_names.json")
//       .then((res) => res.json())
//       .then(setPodMap)
//       .catch(() => setPodMap({}));
//   }, []);

//   useEffect(() => {
//     const fetchPRs = async () => {
//       setLoading(true);
//       try {
//         const res = await fetch(`${API_BASE}/user-prs`);
//         const data = await res.json();
//         setAllPrs(data.items || []);
//       } catch (err) {
//         console.error(err);
//         setAllPrs([]);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchPRs();
//   }, []);

//   useEffect(() => {
//     let data = [...allPrs];

//     if (username.trim()) data = data.filter((pr) => (pr.author || "").toLowerCase().includes(username.trim().toLowerCase()));
//     if (repoSearchTable.trim()) data = data.filter((pr) => (pr.repo_name || "").toLowerCase().includes(repoSearchTable.trim().toLowerCase()));
//     if (stateSearch.trim()) data = data.filter((pr) => (pr.state || "").toLowerCase().includes(stateSearch.trim().toLowerCase()));
//     if (fromDate) data = data.filter((pr) => new Date(pr.created_at) >= new Date(fromDate));
//     if (toDate) data = data.filter((pr) => new Date(pr.created_at) <= new Date(toDate));

//     // ✅ POD filter: match repo_name against all services under selected POD
//     if (podSearch.trim() && podMap[podSearch]) {
//       const podServices = podMap[podSearch].map((s) => s.toLowerCase());
//       data = data.filter((pr) =>
//         podServices.includes((pr.repo_name || "").toLowerCase())
//       );
//     }

//     if (sortConfig.key) {
//       data.sort((a, b) => {
//         let valA = a[sortConfig.key] || "";
//         let valB = b[sortConfig.key] || "";
//         if (sortConfig.key === "created_at") {
//           valA = new Date(valA).getTime();
//           valB = new Date(valB).getTime();
//         } else if (sortConfig.key === "pr_age_days") {
//           valA = valA ?? 0;
//           valB = valB ?? 0;
//         } else {
//           valA = valA.toString().toLowerCase();
//           valB = valB.toString().toLowerCase();
//         }
//         if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
//         if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
//         return 0;
//       });
//     }
//     setFilteredPrs(data);
//     setDisplayedPrs(data.slice(0, perPage));
//     setPage(1);
//   }, [allPrs, username, repoSearchTable, stateSearch, fromDate, toDate, sortConfig, podSearch, podMap]);

//   const handlePageChange = (pageNumber) => {
//     setPage(pageNumber);
//     const start = (pageNumber - 1) * perPage;
//     setDisplayedPrs(filteredPrs.slice(start, start + perPage));
//   };

//   const totalPages = Math.max(1, Math.ceil(filteredPrs.length / perPage));
//   const getPageNumbers = () => {
//     const maxVisible = 7;
//     let start = Math.max(1, page - Math.floor(maxVisible / 2));
//     let end = start + maxVisible - 1;
//     if (end > totalPages) {
//       end = totalPages;
//       start = Math.max(1, end - maxVisible + 1);
//     }
//     return Array.from({ length: end - start + 1 }, (_, i) => start + i);
//   };

//   const handleSort = (key) => {
//     let direction = "asc";
//     if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
//     setSortConfig({ key, direction });
//   };

//   const formControlStyle = {
//     backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
//     color: darkMode ? "#ffffff" : "#000000",
//     borderColor: darkMode ? "#444444" : "#dee2e6",
//   };

//   const dropdownStyle = {
//     backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
//     color: darkMode ? "#ffffff" : "#000000",
//     maxHeight: 150,
//     overflowY: "auto",
//   };

//   // ✅ Filtered POD keys shown in dropdown
//   const filteredPodKeys = Object.keys(podMap).filter((key) =>
//     key.toLowerCase().includes(podSearch.toLowerCase())
//   );

//   return (
//     <div className="container mt-4" style={{ backgroundColor: darkMode ? "#121212" : "#ffffff" }}>
//       <h2 className="text-center mb-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//         GitHub Pull Request Dashboard
//       </h2>
//       <Form>
//         <Row className="align-items-center mb-2">

//            {/* ✅ POD Search Dropdown */}
//           <Col md={3} ref={podDropdownRef} style={{ position: "relative" }}>
//             <Form.Control
//               placeholder="Filter by POD"
//               value={podSearch}
//               onChange={(e) => { setPodSearch(e.target.value); setShowPodDropdown(true); }}
//               onFocus={() => setShowPodDropdown(true)}
//               style={formControlStyle}
//             />
//             {/* ✅ Clear button when a POD is selected */}
//             {podSearch && (
//               <span
//                 onClick={() => { setPodSearch(""); setShowPodDropdown(false); }}
//                 style={{
//                   position: "absolute",
//                   right: "20px",
//                   top: "50%",
//                   transform: "translateY(-50%)",
//                   cursor: "pointer",
//                   color: darkMode ? "#aaa" : "#666",
//                   fontWeight: "bold",
//                   fontSize: "1rem",
//                   zIndex: 10,
//                 }}
//                 title="Clear POD filter"
//               >
//                 ✕
//               </span>
//             )}
//             {showPodDropdown && filteredPodKeys.length > 0 && (
//               <div className="dropdown-menu show w-100" style={dropdownStyle}>
//                 {filteredPodKeys.map((key, idx) => (
//                   <div
//                     key={idx}
//                     className="dropdown-item"
//                     onClick={() => { setPodSearch(key); setShowPodDropdown(false); }}
//                     style={{ ...formControlStyle, cursor: "pointer" }}
//                   >
//                     {key}
//                     <span style={{ fontSize: "0.75rem", color: darkMode ? "#aaa" : "#888", marginLeft: 6 }}>
//                       ({podMap[key].length} services)
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </Col>

//           <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
//             <Form.Control
//               placeholder="Filter by Username"
//               value={username}
//               onChange={(e) => { setUsername(e.target.value); setShowUserDropdown(true); }}
//               onFocus={() => setShowUserDropdown(true)}
//               style={formControlStyle}
//             />
//             {showUserDropdown && (
//               <div className="dropdown-menu show w-100" style={dropdownStyle}>
//                 {allUsers
//                   .filter((u) => u.toLowerCase().includes(username.toLowerCase()))
//                   .map((u, idx) => (
//                     <div
//                       key={idx}
//                       className="dropdown-item"
//                       onClick={() => { setUsername(u); setShowUserDropdown(false); }}
//                       style={{ ...formControlStyle, cursor: "pointer" }}
//                     >
//                       {u}
//                     </div>
//                   ))}
//               </div>
//             )}
//           </Col>

//           <Col md={3} ref={repoDropdownRef} style={{ position: "relative" }}>
//             <Form.Control
//               placeholder="Filter by Repo"
//               value={repoSearchTable}
//               onChange={(e) => { setRepoSearchTable(e.target.value); setShowRepoDropdown(true); }}
//               onFocus={() => setShowRepoDropdown(true)}
//               style={formControlStyle}
//             />
//             {showRepoDropdown && (
//               <div className="dropdown-menu show w-100" style={dropdownStyle}>
//                 {allRepos
//                   .filter((r) => r.toLowerCase().includes(repoSearchTable.toLowerCase()))
//                   .map((r, idx) => (
//                     <div
//                       key={idx}
//                       className="dropdown-item"
//                       onClick={() => { setRepoSearchTable(r); setShowRepoDropdown(false); }}
//                       style={{ ...formControlStyle, cursor: "pointer" }}
//                     >
//                       {r}
//                     </div>
//                   ))}
//               </div>
//             )}
//           </Col>

//           <Col md={3} ref={stateDropdownRef} style={{ position: "relative" }}>
//             <Form.Control
//               placeholder="Filter by State"
//               value={stateSearch}
//               onChange={(e) => { setStateSearch(e.target.value); setShowStateDropdown(true); }}
//               onFocus={() => setShowStateDropdown(true)}
//               style={formControlStyle}
//             />
//             {showStateDropdown && (
//               <div className="dropdown-menu show w-100" style={dropdownStyle}>
//                 {Array.from(new Set(allPrs.map((p) => p.state)))
//                   .filter((st) => st && st.toLowerCase().includes(stateSearch.toLowerCase()))
//                   .map((st, idx) => (
//                     <div
//                       key={idx}
//                       className="dropdown-item"
//                       onClick={() => { setStateSearch(st); setShowStateDropdown(false); }}
//                       style={{ ...formControlStyle, cursor: "pointer" }}
//                     >
//                       {st}
//                     </div>
//                   ))}
//               </div>
//             )}
//           </Col>

         

//         </Row>

//         <Row className="mb-3">
//           <Col md={3}>
//             <Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={formControlStyle} />
//           </Col>
//           <Col md={3}>
//             <Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={formControlStyle} />
//           </Col>
//           {/* ✅ Active POD badge indicator */}
//           {podSearch && podMap[podSearch] && (
//             <Col md={6} className="d-flex align-items-center">
//               <Badge bg="purple" style={{ backgroundColor: "#6f42c1", fontSize: "0.85rem", padding: "6px 12px" }}>
//                 POD: {podSearch} — {podMap[podSearch].length} services
//               </Badge>
//             </Col>
//           )}
//         </Row>
//       </Form>

//       {loading ? (
//         <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//           <Spinner animation="border" style={{ color: darkMode ? "#61dafb" : "#007bff" }} />
//         </div>
//       ) : displayedPrs.length ? (
//         <>
//           <Table
//             striped bordered hover responsive
//             className={`mt-3 ${darkMode ? "table-dark" : "table-light"}`}
//             style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}
//           >
//             <thead
//               className={darkMode ? "table-dark" : "table-light"}
//               style={{ backgroundColor: darkMode ? "#121212" : "#f8f9fa" }}
//             >
//               <tr>
//                 <th onClick={() => handleSort("title")} style={{ cursor: "pointer" }}>Title</th>
//                 <th onClick={() => handleSort("repo_name")} style={{ cursor: "pointer" }}>Repo</th>
//                 <th onClick={() => handleSort("state")} style={{ cursor: "pointer" }}>State</th>
//                 <th onClick={() => handleSort("author")} style={{ cursor: "pointer" }}>Author</th>
//                 <th>Reviewers</th>
//                 <th>Approvers</th>
//                 <th>Jira</th>
//                 <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer" }}>Created At</th>
//                 <th onClick={() => handleSort("pr_age_days")} style={{ cursor: "pointer" }}>Age (days)</th>
//               </tr>
//             </thead>

//             <tbody>
//               {displayedPrs.map((p, idx) => (
//                 <tr key={p.id || idx} style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}>
//                   <td>
//                     <a href={p.html_url} target="_blank" rel="noreferrer"
//                       style={{ color: darkMode ? "#61dafb" : "#007bff", textDecoration: "none" }}>
//                       {p.title}
//                     </a>
//                   </td>
//                   <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{p.repo_name}</td>
//                   <td>
//                     <Badge bg={
//                       p.state === "open" ? "success" :
//                       p.state === "merged" ? "primary" :
//                       p.state === "closed" ? "danger" : "secondary"
//                     }>
//                       {p.state}
//                     </Badge>
//                   </td>
//                   <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{p.author}</td>
//                   <td>
//                     {p.requested_reviewers?.length ? (
//                       p.requested_reviewers.map((r, i) => (
//                         <Badge key={i} bg="info" text={darkMode ? "light" : "dark"} className="me-1">{r}</Badge>
//                       ))
//                     ) : (
//                       <span style={{ color: darkMode ? "#b0b0b0" : "#666666" }}>-</span>
//                     )}
//                   </td>
//                   <td>
//                     {p.approvers?.length ? (
//                       p.approvers.map((r, i) => (
//                         <Badge key={i} bg="success" text="light" className="me-1">{r}</Badge>
//                       ))
//                     ) : (
//                       <span style={{ color: darkMode ? "#b0b0b0" : "#666666" }}>-</span>
//                     )}
//                   </td>
//                   <td>
//                     {p.jira_url ? (
//                       <a href={p.jira_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
//                         <Badge bg="warning" text="dark" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
//                           {p.jira_key}
//                         </Badge>
//                       </a>
//                     ) : (
//                       <span style={{ color: darkMode ? "#b0b0b0" : "#999999" }}>—</span>
//                     )}
//                   </td>
//                   <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//                     {new Date(p.created_at).toLocaleString()}
//                   </td>
//                   <td>
//                     {p.pr_age_days !== null && p.pr_age_days !== undefined ? (
//                       <Badge bg={
//                         p.pr_age_days <= 7 ? "success" :
//                         p.pr_age_days <= 14 ? "warning" :
//                         "danger"
//                       }>
//                         {p.pr_age_days}
//                       </Badge>
//                     ) : "-"}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </Table>

//           <Pagination className="justify-content-center">
//             <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
//             <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
//             {getPageNumbers().map((p) => (
//               <Pagination.Item
//                 key={p} active={p === page} onClick={() => handlePageChange(p)}
//                 style={{
//                   backgroundColor: p === page ? (darkMode ? "#61dafb" : "#007bff") : "transparent",
//                   color: darkMode ? "#ffffff" : "#000000",
//                 }}
//               >
//                 {p}
//               </Pagination.Item>
//             ))}
//             <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
//             <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
//           </Pagination>
//         </>
//       ) : (
//         <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//           No pull requests found
//         </div>
//       )}
//     </div>
//   );
// };

// export default UserPrsDashboard;








// import React, { useEffect, useRef, useState } from "react";
// import { Form, Row, Col, Table, Spinner, Pagination, Badge } from "react-bootstrap";
// import { useTheme } from "../ThemeContext";

// const API_BASE = "http://127.0.0.1:5000/api";

// const UserPrsDashboard = () => {
//   const { darkMode } = useTheme();

//   const [username, setUsername] = useState("");
//   const [fromDate, setFromDate] = useState("");
//   const [toDate, setToDate] = useState("");

//   const [repoSearchTable, setRepoSearchTable] = useState("");
//   const [stateSearch, setStateSearch] = useState("");

//   const [allPrs, setAllPrs] = useState([]);
//   const [filteredPrs, setFilteredPrs] = useState([]);
//   const [displayedPrs, setDisplayedPrs] = useState([]);

//   const [allUsers, setAllUsers] = useState([]);
//   const [allRepos, setAllRepos] = useState([]);

//   const [loading, setLoading] = useState(false);
//   const [page, setPage] = useState(1);
//   const perPage = 10;
//   const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

//   const repoDropdownRef = useRef(null);
//   const stateDropdownRef = useRef(null);
//   const userDropdownRef = useRef(null);

//   const [showRepoDropdown, setShowRepoDropdown] = useState(false);
//   const [showStateDropdown, setShowStateDropdown] = useState(false);
//   const [showUserDropdown, setShowUserDropdown] = useState(false);

//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target)) setShowRepoDropdown(false);
//       if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target)) setShowStateDropdown(false);
//       if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) setShowUserDropdown(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     fetch("/user_names.json")
//       .then((res) => res.json())
//       .then(setAllUsers)
//       .catch(() => setAllUsers([]));
//     fetch("/repo_names.json")
//       .then((res) => res.json())
//       .then(setAllRepos)
//       .catch(() => setAllRepos([]));
//   }, []);

//   useEffect(() => {
//     const fetchPRs = async () => {
//       setLoading(true);
//       try {
//         const res = await fetch(`${API_BASE}/user-prs`);
//         const data = await res.json();
//         setAllPrs(data.items || []);
//       } catch (err) {
//         console.error(err);
//         setAllPrs([]);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchPRs();
//   }, []);

//   useEffect(() => {
//     let data = [...allPrs];

//     if (username.trim()) data = data.filter((pr) => (pr.author || "").toLowerCase().includes(username.trim().toLowerCase()));
//     if (repoSearchTable.trim()) data = data.filter((pr) => (pr.repo_name || "").toLowerCase().includes(repoSearchTable.trim().toLowerCase()));
//     if (stateSearch.trim()) data = data.filter((pr) => (pr.state || "").toLowerCase().includes(stateSearch.trim().toLowerCase()));
//     if (fromDate) data = data.filter((pr) => new Date(pr.created_at) >= new Date(fromDate));
//     if (toDate) data = data.filter((pr) => new Date(pr.created_at) <= new Date(toDate));

//     if (sortConfig.key) {
//       data.sort((a, b) => {
//         let valA = a[sortConfig.key] || "";
//         let valB = b[sortConfig.key] || "";
//         if (sortConfig.key === "created_at") {
//           valA = new Date(valA).getTime();
//           valB = new Date(valB).getTime();
//         }
//         else if (sortConfig.key === "pr_age_days") {
//       valA = valA ?? 0;
//       valB = valB ?? 0;} 
//         else {
//           valA = valA.toString().toLowerCase();
//           valB = valB.toString().toLowerCase();
//         }
//         if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
//         if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
//         return 0;
//       });
//     }
//     setFilteredPrs(data);
//     setDisplayedPrs(data.slice(0, perPage));
//     setPage(1);
//   }, [allPrs, username, repoSearchTable, stateSearch, fromDate, toDate, sortConfig]);

//   const handlePageChange = (pageNumber) => {
//     setPage(pageNumber);
//     const start = (pageNumber - 1) * perPage;
//     setDisplayedPrs(filteredPrs.slice(start, start + perPage));
//   };

//   const totalPages = Math.max(1, Math.ceil(filteredPrs.length / perPage));
//   const getPageNumbers = () => {
//     const maxVisible = 7;
//     let start = Math.max(1, page - Math.floor(maxVisible / 2));
//     let end = start + maxVisible - 1;
//     if (end > totalPages) {
//       end = totalPages;
//       start = Math.max(1, end - maxVisible + 1);
//     }
//     return Array.from({ length: end - start + 1 }, (_, i) => start + i);
//   };

//   const handleSort = (key) => {
//     let direction = "asc";
//     if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
//     setSortConfig({ key, direction });
//   };

//   const formControlStyle = {
//     backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
//     color: darkMode ? "#ffffff" : "#000000",
//     borderColor: darkMode ? "#444444" : "#dee2e6",
//   };

//   const dropdownStyle = {
//     backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
//     color: darkMode ? "#ffffff" : "#000000",
//     maxHeight: 150,
//     overflowY: "auto",
//   };

//   return (
//     <div className="container mt-4" style={{ backgroundColor: darkMode ? "#121212" : "#ffffff" }}>
//       <h2 className="text-center mb-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//         GitHub Pull Request Dashboard
//       </h2>
//       <Form>
//         <Row className="align-items-center mb-2">

//           <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
//             <Form.Control
//               placeholder="Filter by Username"
//               value={username}
//               onChange={(e) => { setUsername(e.target.value); setShowUserDropdown(true); }}
//               onFocus={() => setShowUserDropdown(true)}
//               style={formControlStyle}
//             />
//             {showUserDropdown && (
//               <div className="dropdown-menu show w-100" style={dropdownStyle}>
//                 {allUsers
//                   .filter((u) => u.toLowerCase().includes(username.toLowerCase()))
//                   .map((u, idx) => (
//                     <div
//                       key={idx}
//                       className="dropdown-item"
//                       onClick={() => { setUsername(u); setShowUserDropdown(false); }}
//                       style={{ ...formControlStyle, cursor: "pointer" }}
//                     >
//                       {u}
//                     </div>
//                   ))}
//               </div>
//             )}
//           </Col>

//           <Col md={3} ref={repoDropdownRef} style={{ position: "relative" }}>
//             <Form.Control
//               placeholder="Filter by Repo"
//               value={repoSearchTable}
//               onChange={(e) => { setRepoSearchTable(e.target.value); setShowRepoDropdown(true); }}
//               onFocus={() => setShowRepoDropdown(true)}
//               style={formControlStyle}
//             />
//             {showRepoDropdown && (
//               <div className="dropdown-menu show w-100" style={dropdownStyle}>
//                 {allRepos
//                   .filter((r) => r.toLowerCase().includes(repoSearchTable.toLowerCase()))
//                   .map((r, idx) => (
//                     <div
//                       key={idx}
//                       className="dropdown-item"
//                       onClick={() => { setRepoSearchTable(r); setShowRepoDropdown(false); }}
//                       style={{ ...formControlStyle, cursor: "pointer" }}
//                     >
//                       {r}
//                     </div>
//                   ))}
//               </div>
//             )}
//           </Col>

//           <Col md={3} ref={stateDropdownRef} style={{ position: "relative" }}>
//             <Form.Control
//               placeholder="Filter by State"
//               value={stateSearch}
//               onChange={(e) => {setStateSearch(e.target.value); setShowStateDropdown(true); }}
//               onFocus={() => setShowStateDropdown(true)}
//               style={formControlStyle}
//             />
//             {showStateDropdown && (
//               <div className="dropdown-menu show w-100" style={dropdownStyle}>
//                 {Array.from(new Set(allPrs.map((p) => p.state)))
//                   .filter((st) => st && st.toLowerCase().includes(stateSearch.toLowerCase()))
//                   .map((st, idx) => (
//                     <div
//                       key={idx}
//                       className="dropdown-item"
//                       onClick={() => { setStateSearch(st); setShowStateDropdown(false); }}
//                       style={{ ...formControlStyle, cursor: "pointer" }}
//                     >
//                       {st}
//                     </div>
//                   ))}
//               </div>
//             )}
//           </Col>
//         </Row>

//         <Row className="mb-3">
//           <Col md={3}>
//             <Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={formControlStyle} />
//           </Col>
//           <Col md={3}>
//             <Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={formControlStyle} />
//           </Col>
//         </Row>
//       </Form>

//       {loading ? (
//         <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//           <Spinner animation="border" style={{ color: darkMode ? "#61dafb" : "#007bff" }} />
//         </div>
//       ) : displayedPrs.length ? (
//         <>
//           <Table
//             striped bordered hover responsive
//             className={`mt-3 ${darkMode ? "table-dark" : "table-light"}`}
//             style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}
//           >
//             <thead
//               className={darkMode ? "table-dark" : "table-light"}
//               style={{ backgroundColor: darkMode ? "#121212" : "#f8f9fa" }}
//             >
//               <tr>
//                 <th onClick={() => handleSort("title")} style={{ cursor: "pointer" }}>Title</th>
//                 {/* ✅ Jira column — after Title */}
               
//                 <th onClick={() => handleSort("repo_name")} style={{ cursor: "pointer" }}>Repo</th>
//                 <th onClick={() => handleSort("state")} style={{ cursor: "pointer" }}>State</th>
//                 <th onClick={() => handleSort("author")} style={{ cursor: "pointer" }}>Author</th>
//                 <th>Reviewers</th>
//                 <th>Approvers</th>
//                  <th>Jira</th>
//                 <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer" }}>Created At</th>
//                 {/* <th onClick={() => handleSort("age_days")} style={{ cursor: "pointer" }}>Age (days)</th> */}
//                 <th onClick={() => handleSort("pr_age_days")} style={{ cursor: "pointer" }}>Age (days)</th>
//               </tr>
//             </thead>

//             <tbody>
//               {displayedPrs.map((p, idx) => (
//                 <tr key={p.id || idx} style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}>

//                   {/* Title */}
//                   <td>
//                     <a href={p.html_url} target="_blank" rel="noreferrer"
//                       style={{ color: darkMode ? "#61dafb" : "#007bff", textDecoration: "none" }}>
//                       {p.title}
//                     </a>
//                   </td>

//                   {/* Repo */}
//                   <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{p.repo_name}</td>

//                   {/* State */}
//                   <td>
//                     <Badge bg={
//                       p.state === "open" ? "success" :
//                       p.state === "merged" ? "primary" :
//                       p.state === "closed" ? "danger" : "secondary"
//                     }>
//                       {p.state}
//                     </Badge>
//                   </td>

//                   {/* Author */}
//                   <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{p.author}</td>

//                   {/* Reviewers */}
//                   <td>
//                     {p.requested_reviewers?.length ? (
//                       p.requested_reviewers.map((r, i) => (
//                         <Badge key={i} bg="info" text={darkMode ? "light" : "dark"} className="me-1">{r}</Badge>
//                       ))
//                     ) : (
//                       <span style={{ color: darkMode ? "#b0b0b0" : "#666666" }}>-</span>
//                     )}
//                   </td>

//                   {/* Approvers */}
//                   <td>
//                     {p.approvers?.length ? (
//                       p.approvers.map((r, i) => (
//                         <Badge key={i} bg="success" text="light" className="me-1">{r}</Badge>
//                       ))
//                     ) : (
//                       <span style={{ color: darkMode ? "#b0b0b0" : "#666666" }}>-</span>
//                     )}
//                   </td>

//                   {/* ✅ Jira */}
//                   <td>
//                     {p.jira_url ? (
//                       <a href={p.jira_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
//                         <Badge bg="warning" text="dark" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
//                           {p.jira_key}
//                         </Badge>
//                       </a>
//                     ) : (
//                       <span style={{ color: darkMode ? "#b0b0b0" : "#999999" }}>—</span>
//                     )}
//                   </td>

//                   {/* Created At */}
//                   <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//                     {new Date(p.created_at).toLocaleString()}
//                   </td>

//                   {/* <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//                     {(p.age_days)}
//                   </td> */}

//                          <td>
//   {p.pr_age_days !== null && p.pr_age_days !== undefined ? (
//     <Badge bg={
//       p.pr_age_days <= 7 ? "success" :
//       p.pr_age_days <= 14 ? "warning" :
//       "danger"
//     }>
//       {p.pr_age_days}
//     </Badge>
//   ) : "-"}
// </td>
 

//                 </tr>
//               ))}
//             </tbody>
//           </Table>

//           <Pagination className="justify-content-center">
//             <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
//             <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
//             {getPageNumbers().map((p) => (
//               <Pagination.Item
//                 key={p} active={p === page} onClick={() => handlePageChange(p)}
//                 style={{
//                   backgroundColor: p === page ? (darkMode ? "#61dafb" : "#007bff") : "transparent",
//                   color: darkMode ? "#ffffff" : "#000000",
//                 }}
//               >
//                 {p}
//               </Pagination.Item>
//             ))}
//             <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
//             <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
//           </Pagination>
//         </>
//       ) : (
//         <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
//           No pull requests found
//         </div>
//       )}
//     </div>
//   );
// };

// export default UserPrsDashboard;
