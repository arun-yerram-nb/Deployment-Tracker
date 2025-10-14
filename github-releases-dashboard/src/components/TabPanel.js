import React, { useEffect, useState } from "react";
import { Spinner, Button, Row, Col } from "react-bootstrap";
import PrsTable from "./PrsTable";
import { fetchPRs } from "../api/github";

const PER_PAGE = 50;

const TabPanel = ({ category, username }) => {
  const [prs, setPrs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = async (pageNumber = 1, append = false) => {
    if (!username) return;
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const data = await fetchPRs(username, category, pageNumber);

      const fetched = data.items || [];
      setTotalCount(data.total_count || 0);
      setPrs(prev => (append ? [...prev, ...fetched] : fetched));
    } catch (err) {
      setError(err.message || "Fetch error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPrs([]);
    setPage(1);
    setTotalCount(0);
    setError(null);
    if (username) fetchPage(1, false);
  }, [username, category]);

  const loadMore = () => {
    const next = page + 1;
    fetchPage(next, true);
    setPage(next);
  };

  const hasMore = prs.length < totalCount;

  return (
    <div>
      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" /> <div>Loading {category} PRs...</div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <>
          <PrsTable items={prs} />
          {hasMore && (
            <Row className="mt-2">
              <Col className="text-center">
                <Button onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <>
                      <Spinner size="sm" animation="border" /> Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </Col>
            </Row>
          )}
        </>
      )}
    </div>
  );
};

export default TabPanel;
