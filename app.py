import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from dotenv import load_dotenv

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise RuntimeError("GITHUB_TOKEN must be set in .env")

API_URL = "https://api.github.com"
ORG_NAME = "NationsBenefits"
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}

app = Flask(__name__)
CORS(app)

# ---------- PRs config ----------
CATEGORY_TO_QUAL = {
    "created": "author",
    "assigned": "assignee",
    "review-requested": "review-requested",
    "reviewed": "reviewed-by"
}
# Maps frontend category names to GitHub GraphQL qualifiers.
# Example: "created" → search PRs where the user is author

GRAPHQL_URL = "https://api.github.com/graphql"
GRAPHQL_SEARCH_PR = """
query($q: String!, $first: Int!) {
  search(query: $q, type: ISSUE, first: $first) {
    issueCount
    nodes {
      ... on PullRequest {
        title
        number
        url
        state
        createdAt
        mergedAt
        updatedAt
        repository { nameWithOwner }
      }
    }
  }
}
"""

def run_graphql(query, variables):
    try:
        r = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query, "variables": variables}, timeout=20)
    except requests.RequestException as e:
        return None, 500, str(e)
    if r.status_code != 200:
        return None, r.status_code, r.text
    return r.json(), 200, None

def format_node(node):
    repo_full = node.get("repository", {}).get("nameWithOwner") or ""
    owner, repo = (repo_full.split("/", 1) + [""])[:2]
    state = (node.get("state") or "").lower()
    if node.get("mergedAt"):
        state = "merged"
    return {
        "title": node.get("title"),
        "number": node.get("number"),
        "html_url": node.get("url"),
        "state": state,
        "created_at": node.get("createdAt"),
        "updated_at": node.get("updatedAt"),
        "repo_owner": owner,
        "repo_name": repo,
    }

# ---------- PRs endpoint ----------
@app.route("/api/prs/<category>")
def prs_category(category):
    if category not in CATEGORY_TO_QUAL:
        return jsonify({"error": f"Unsupported category '{category}'"}), 400
    username = request.args.get("username", "").strip()
    if not username:
        return jsonify({"error": "username is required"}), 400

    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 20))
    except ValueError:
        return jsonify({"error": "page/per_page must be integers"}), 400

    qualifier = CATEGORY_TO_QUAL[category]
    q = f"{qualifier}:{username} type:pr"
    variables = {"q": q, "first": page*per_page}
    data, status, err = run_graphql(GRAPHQL_SEARCH_PR, variables)
    if data is None:
        return jsonify({"error": err}), status

    nodes = data.get("data", {}).get("search", {}).get("nodes", [])
    formatted = [format_node(n) for n in nodes]
    start = (page-1)*per_page
    end = start + per_page
    return jsonify({
        "items": formatted[start:end],
        "total_count": data.get("data", {}).get("search", {}).get("issueCount", 0),
        "page": page,
        "per_page": per_page
    })

# ---------- Fetch igloo* repos ----------
@app.route("/api/repos")
def get_repos():
    repos = []
    page = 1
    while True:
        r = requests.get(f"{API_URL}/orgs/{ORG_NAME}/repos", headers=HEADERS, params={"per_page": 100, "page": page})
        if r.status_code != 200:
            return jsonify({"error": r.text}), r.status_code
        data = r.json()
        if not data:
            break
        repos.extend([repo["name"] for repo in data if repo["name"].startswith("igloo")])
        page += 1
    return jsonify({"repos": repos})

# ---------- User releases ----------
@app.route("/api/user-releases")
def get_user_releases():
    username = request.args.get("username", "").strip()
    selected_repo = request.args.get("repo", "").strip()

    # Fetch all igloo* repos
    all_repos = []
    page = 1
    while True:
        r = requests.get(f"{API_URL}/orgs/{ORG_NAME}/repos", headers=HEADERS, params={"per_page": 100, "page": page})
        if r.status_code != 200:
            return jsonify({"error": r.text}), r.status_code
        data = r.json()
        if not data:
            break
        all_repos.extend([repo["name"] for repo in data if repo["name"].startswith("igloo")])
        page += 1

    # Condition 1: Repo selected → use only that repo
    if selected_repo:
        all_repos = [selected_repo] if selected_repo in all_repos else []

    # Condition 2: Username only → keep all repos (already all_repos)
    # Condition 3: Both username + repo → handled above

    releases = []
    for repo in all_repos:
        r = requests.get(f"{API_URL}/repos/{ORG_NAME}/{repo}/releases", headers=HEADERS)
        if r.status_code != 200:
            continue
        for rel in r.json():
            author_login = rel.get("author", {}).get("login")
            # Include release if username empty OR username matches author
            if not username or (author_login and author_login.lower() == username.lower()):
                releases.append({
                    "name": rel.get("name"),
                    "tag_name": rel.get("tag_name"),
                    "repo_name": repo,
                    "html_url": rel.get("html_url"),
                    "created_at": rel.get("created_at")
                })

    return jsonify({"items": releases, "total_count": len(releases)})

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(debug=True)


# import os
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# import requests
# from dotenv import load_dotenv

# load_dotenv()
# GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
# if not GITHUB_TOKEN:
#     raise RuntimeError("GITHUB_TOKEN must be set in .env")

# API_URL = "https://api.github.com"
# ORG_NAME = "NationsBenefits"
# HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}

# app = Flask(__name__)
# CORS(app)

# # ---------- PRs config ----------
# CATEGORY_TO_QUAL = {
#     "created": "author",
#     "assigned": "assignee",
#     "review-requested": "review-requested",
#     "reviewed": "reviewed-by"
# }

# GRAPHQL_URL = "https://api.github.com/graphql"
# GRAPHQL_SEARCH_PR = """
# query($q: String!, $first: Int!) {
#   search(query: $q, type: ISSUE, first: $first) {
#     issueCount
#     nodes {
#       ... on PullRequest {
#         title
#         number
#         url
#         state
#         createdAt
#         mergedAt
#         updatedAt
#         repository { nameWithOwner }
#       }
#     }
#   }
# }
# """

# def run_graphql(query, variables):
#     try:
#         r = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query, "variables": variables}, timeout=20)
#     except requests.RequestException as e:
#         return None, 500, str(e)
#     if r.status_code != 200:
#         return None, r.status_code, r.text
#     return r.json(), 200, None

# def format_node(node):
#     repo_full = node.get("repository", {}).get("nameWithOwner") or ""
#     owner, repo = (repo_full.split("/", 1) + [""])[:2]
#     state = (node.get("state") or "").lower()
#     if node.get("mergedAt"):
#         state = "merged"
#     return {
#         "title": node.get("title"),
#         "number": node.get("number"),
#         "html_url": node.get("url"),
#         "state": state,
#         "created_at": node.get("createdAt"),
#         "updated_at": node.get("updatedAt"),
#         "repo_owner": owner,
#         "repo_name": repo,
#     }

# # ---------- PRs endpoint ----------
# @app.route("/api/prs/<category>")
# def prs_category(category):
#     if category not in CATEGORY_TO_QUAL:
#         return jsonify({"error": f"Unsupported category '{category}'"}), 400
#     username = request.args.get("username", "").strip()
#     if not username:
#         return jsonify({"error": "username is required"}), 400

#     try:
#         page = int(request.args.get("page", 1))
#         per_page = int(request.args.get("per_page", 20))
#     except ValueError:
#         return jsonify({"error": "page/per_page must be integers"}), 400

#     qualifier = CATEGORY_TO_QUAL[category]
#     q = f"{qualifier}:{username} type:pr"
#     variables = {"q": q, "first": page*per_page}
#     data, status, err = run_graphql(GRAPHQL_SEARCH_PR, variables)
#     if data is None:
#         return jsonify({"error": err}), status

#     nodes = data.get("data", {}).get("search", {}).get("nodes", [])
#     formatted = [format_node(n) for n in nodes]
#     start = (page-1)*per_page
#     end = start + per_page
#     return jsonify({
#         "items": formatted[start:end],
#         "total_count": data.get("data", {}).get("search", {}).get("issueCount", 0),
#         "page": page,
#         "per_page": per_page
#     })

# # ---------- Fetch igloo* repos ----------
# @app.route("/api/repos")
# def get_repos():
#     repos = []
#     page = 1
#     while True:
#         r = requests.get(f"{API_URL}/orgs/{ORG_NAME}/repos", headers=HEADERS, params={"per_page": 100, "page": page})
#         if r.status_code != 200:
#             return jsonify({"error": r.text}), r.status_code
#         data = r.json()
#         if not data:
#             break
#         repos.extend([repo["name"] for repo in data if repo["name"].startswith("igloo")])
#         page += 1
#     return jsonify({"repos": repos})

# # ---------- User releases ----------
# @app.route("/api/user-releases")
# def get_user_releases():
#     username = request.args.get("username", "").strip()
#     if not username:
#         return jsonify({"error": "username is required"}), 400

#     selected_repo = request.args.get("repo", "").strip()
#     all_repos = []
#     page = 1
#     while True:
#         r = requests.get(f"{API_URL}/orgs/{ORG_NAME}/repos", headers=HEADERS, params={"per_page": 100, "page": page})
#         if r.status_code != 200:
#             return jsonify({"error": r.text}), r.status_code
#         data = r.json()
#         if not data:
#             break
#         all_repos.extend([repo["name"] for repo in data if repo["name"].startswith("igloo")])
#         page += 1

#     if selected_repo:
#         all_repos = [selected_repo] if selected_repo in all_repos else []

#     releases = []
#     for repo in all_repos:
#         r = requests.get(f"{API_URL}/repos/{ORG_NAME}/{repo}/releases", headers=HEADERS)
#         if r.status_code != 200:
#             continue
#         for rel in r.json():
#             author_login = rel.get("author", {}).get("login")
#             if author_login and author_login.lower() == username.lower():
#                 releases.append({
#                     "name": rel.get("name"),
#                     "tag_name": rel.get("tag_name"),
#                     "repo_name": repo,
#                     "html_url": rel.get("html_url"),
#                     "created_at": rel.get("created_at")
#                 })

#     return jsonify({"items": releases, "total_count": len(releases)})

# @app.route("/api/health")
# def health():
#     return jsonify({"status": "ok"})

# if __name__ == "__main__":
#     app.run(debug=True)


# import os
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# import requests
# from dotenv import load_dotenv

# load_dotenv()
# GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
# if not GITHUB_TOKEN:
#     raise RuntimeError("GITHUB_TOKEN must be set in .env")

# app = Flask(__name__)
# CORS(app)

# HEADERS = {"Authorization": f"token {GITHUB_TOKEN}"}

# DEFAULT_PER_PAGE = 20

# # ------------------ PRs GraphQL ------------------
# GRAPHQL_URL = "https://api.github.com/graphql"
# GRAPHQL_SEARCH_PR = """
# query($q: String!, $first: Int!) {
#   search(query: $q, type: ISSUE, first: $first) {
#     issueCount
#     nodes {
#       ... on PullRequest {
#         title
#         number
#         url
#         state
#         createdAt
#         mergedAt
#         updatedAt
#         repository { nameWithOwner }
#       }
#     }
#   }
# }
# """

# CATEGORY_TO_QUAL = {
#     "created": "author",
#     "assigned": "assignee",
#     "review-requested": "review-requested",
#     "reviewed": "reviewed-by"
# }

# def run_graphql(query, variables):
#     try:
#         r = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query, "variables": variables}, timeout=20)
#     except requests.RequestException as e:
#         return None, 500, str(e)
#     if r.status_code != 200:
#         return None, r.status_code, r.text
#     try:
#         return r.json(), 200, None
#     except Exception as e:
#         return None, 500, str(e)

# def format_node(node):
#     repo_full = node.get("repository", {}).get("nameWithOwner") or ""
#     owner, repo = (repo_full.split("/", 1) + [""])[:2]
#     state = (node.get("state") or "").lower()
#     if node.get("mergedAt"):
#         state = "merged"
#     return {
#         "title": node.get("title"),
#         "number": node.get("number"),
#         "html_url": node.get("url"),
#         "state": state,
#         "created_at": node.get("createdAt"),
#         "updated_at": node.get("updatedAt"),
#         "repo_owner": owner,
#         "repo_name": repo,
#     }

# @app.route("/api/prs/<category>")
# def prs_category(category):
#     category = category.strip()
#     if category not in CATEGORY_TO_QUAL:
#         return jsonify({"error": f"Unsupported category '{category}'"}), 400

#     username = request.args.get("username", "").strip()
#     if not username:
#         return jsonify({"error": "Please provide 'username' query parameter."}), 400

#     try:
#         page = int(request.args.get("page", 1))
#         per_page = int(request.args.get("per_page", DEFAULT_PER_PAGE))
#     except ValueError:
#         return jsonify({"error": "page and per_page must be integers."}), 400
#     if page < 1 or per_page < 1:
#         return jsonify({"error": "page and per_page must be >= 1"}), 400

#     qualifier = CATEGORY_TO_QUAL[category]
#     q = f"{qualifier}:{username} type:pr"

#     requested_first = page * per_page
#     first = requested_first if requested_first <= 100 else 100

#     variables = {"q": q, "first": first}
#     data, status, err = run_graphql(GRAPHQL_SEARCH_PR, variables)
#     if data is None:
#         return jsonify({"error": f"GraphQL request failed: {err}"}), status

#     search = data.get("data", {}).get("search", {})
#     issue_count = search.get("issueCount", 0)
#     nodes = search.get("nodes", []) or []

#     formatted = [format_node(n) for n in nodes]

#     start_idx = (page - 1) * per_page
#     end_idx = start_idx + per_page
#     page_items = formatted[start_idx:end_idx] if start_idx < len(formatted) else []

#     return jsonify({
#         "items": page_items,
#         "total_count": issue_count,
#         "page": page,
#         "per_page": per_page
#     }), 200

# # ------------------ List all repos in NationsBenefits ------------------
# @app.route("/api/repos")
# def list_org_repos():
#     org = "NationsBenefits"
#     try:
#         url = f"https://api.github.com/orgs/{org}/repos?per_page=100"
#         r = requests.get(url, headers=HEADERS, timeout=15)
#         r.raise_for_status()
#         repos = r.json()
#         repo_names = [repo["name"] for repo in repos if repo.get("name")]
#         return jsonify({"repos": repo_names, "total_count": len(repo_names)}), 200
#     except Exception as e:
#         return jsonify({"error": f"Failed to fetch repos: {str(e)}"}), 500

# # ------------------ Releases created by user in NationsBenefits ------------------
# @app.route("/api/user-releases")
# def user_releases_in_org():
#     username = request.args.get("username", "").strip()
#     org = "NationsBenefits"
#     if not username:
#         return jsonify({"error": "Please provide 'username' query parameter."}), 400

#     try:
#         # Step 1: Get all repos
#         url = f"https://api.github.com/orgs/{org}/repos?per_page=100"
#         r = requests.get(url, headers=HEADERS, timeout=15)
#         r.raise_for_status()
#         repos = r.json()
#     except Exception as e:
#         return jsonify({"error": f"Failed to fetch repos: {str(e)}"}), 500

#     releases = []

#     # Step 2: Fetch releases per repo
#     for repo in repos:
#         repo_name = repo.get("name")
#         if not repo_name:
#             continue
#         try:
#             rel_url = f"https://api.github.com/repos/{org}/{repo_name}/releases?per_page=100"
#             r2 = requests.get(rel_url, headers=HEADERS, timeout=15)
#             if r2.status_code != 200:
#                 continue
#             for rel in r2.json():
#                 author = rel.get("author", {}).get("login")
#                 if author == username:
#                     releases.append({
#                         "name": rel.get("name") or rel.get("tag_name"),
#                         "tag_name": rel.get("tag_name"),
#                         "repo_name": repo_name,
#                         "html_url": rel.get("html_url"),
#                         "created_at": rel.get("created_at")
#                     })
#         except Exception:
#             continue

#     return jsonify({"items": releases, "total_count": len(releases)}), 200

# @app.route("/api/health")
# def health():
#     return jsonify({"status": "ok"}), 200

# if __name__ == "__main__":
#     app.run(debug=True)




# import os
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# import requests
# from dotenv import load_dotenv

# load_dotenv()
# GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
# if not GITHUB_TOKEN:
#     raise RuntimeError("GITHUB_TOKEN must be set in .env")

# app = Flask(__name__)
# CORS(app)

# HEADERS = {"Authorization": f"token {GITHUB_TOKEN}"}

# DEFAULT_PER_PAGE = 20

# # ------------------ PRs GraphQL (existing) ------------------
# GRAPHQL_URL = "https://api.github.com/graphql"
# GRAPHQL_SEARCH_PR = """
# query($q: String!, $first: Int!) {
#   search(query: $q, type: ISSUE, first: $first) {
#     issueCount
#     nodes {
#       ... on PullRequest {
#         title
#         number
#         url
#         state
#         createdAt
#         mergedAt
#         updatedAt
#         repository { nameWithOwner }
#       }
#     }
#   }
# }
# """

# CATEGORY_TO_QUAL = {
#     "created": "author",
#     "assigned": "assignee",
#     "review-requested": "review-requested",
#     "reviewed": "reviewed-by"
# }

# def run_graphql(query, variables):
#     try:
#         r = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query, "variables": variables}, timeout=20)
#     except requests.RequestException as e:
#         return None, 500, str(e)
#     if r.status_code != 200:
#         return None, r.status_code, r.text
#     try:
#         return r.json(), 200, None
#     except Exception as e:
#         return None, 500, str(e)

# def format_node(node):
#     repo_full = node.get("repository", {}).get("nameWithOwner") or ""
#     owner, repo = (repo_full.split("/", 1) + [""])[:2]
#     state = (node.get("state") or "").lower()
#     if node.get("mergedAt"):
#         state = "merged"
#     return {
#         "title": node.get("title"),
#         "number": node.get("number"),
#         "html_url": node.get("url"),
#         "state": state,
#         "created_at": node.get("createdAt"),
#         "updated_at": node.get("updatedAt"),
#         "repo_owner": owner,
#         "repo_name": repo,
#     }

# @app.route("/api/prs/<category>")
# def prs_category(category):
#     category = category.strip()
#     if category not in CATEGORY_TO_QUAL:
#         return jsonify({"error": f"Unsupported category '{category}'"}), 400

#     username = request.args.get("username", "").strip()
#     if not username:
#         return jsonify({"error": "Please provide 'username' query parameter."}), 400

#     try:
#         page = int(request.args.get("page", 1))
#         per_page = int(request.args.get("per_page", DEFAULT_PER_PAGE))
#     except ValueError:
#         return jsonify({"error": "page and per_page must be integers."}), 400
#     if page < 1 or per_page < 1:
#         return jsonify({"error": "page and per_page must be >= 1"}), 400

#     qualifier = CATEGORY_TO_QUAL[category]
#     q = f"{qualifier}:{username} type:pr"

#     requested_first = page * per_page
#     first = requested_first if requested_first <= 100 else 100  # GraphQL cap

#     variables = {"q": q, "first": first}
#     data, status, err = run_graphql(GRAPHQL_SEARCH_PR, variables)
#     if data is None:
#         return jsonify({"error": f"GraphQL request failed: {err}"}), status

#     search = data.get("data", {}).get("search", {})
#     issue_count = search.get("issueCount", 0)
#     nodes = search.get("nodes", []) or []

#     formatted = [format_node(n) for n in nodes]

#     start_idx = (page - 1) * per_page
#     end_idx = start_idx + per_page
#     page_items = formatted[start_idx:end_idx] if start_idx < len(formatted) else []

#     return jsonify({
#         "items": page_items,
#         "total_count": issue_count,
#         "page": page,
#         "per_page": per_page
#     }), 200

# # ------------------ Releases created by user in NationsBenefits ------------------
# @app.route("/api/user-releases")
# def user_releases_in_org():
#     username = request.args.get("username", "").strip()
#     org = "NationsBenefits"
#     if not username:
#         return jsonify({"error": "Please provide 'username' query parameter."}), 400

#     # Step 1: Get all repos in org
#     repos_url = f"https://api.github.com/orgs/{org}/repos?per_page=100"
#     try:
#         r = requests.get(repos_url, headers=HEADERS, timeout=15)
#         r.raise_for_status()
#         repos = r.json()
#     except Exception as e:
#         return jsonify({"error": f"Failed to fetch repos: {str(e)}"}), 500

#     releases = []

#     # Step 2: Fetch releases per repo
#     for repo in repos:
#         repo_name = repo.get("name")
#         if not repo_name:
#             continue
#         releases_url = f"https://api.github.com/repos/{org}/{repo_name}/releases?per_page=100"
#         try:
#             r2 = requests.get(releases_url, headers=HEADERS, timeout=15)
#             if r2.status_code != 200:
#                 continue
#             for rel in r2.json():
#                 author = rel.get("author", {}).get("login")
#                 if author == username:
#                     releases.append({
#                         "name": rel.get("name") or rel.get("tag_name"),
#                         "tag_name": rel.get("tag_name"),
#                         "repo_name": repo_name,
#                         "html_url": rel.get("html_url"),
#                         "created_at": rel.get("created_at")
#                     })
#         except Exception:
#             continue  # skip repo if fails

#     return jsonify({"items": releases, "total_count": len(releases)}), 200

# @app.route("/api/health")
# def health():
#     return jsonify({"status": "ok"}), 200

# if __name__ == "__main__":
#     app.run(debug=True)



# # app.py
# import os
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# import requests
# from dotenv import load_dotenv

# load_dotenv()
# GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
# if not GITHUB_TOKEN:
#     raise RuntimeError("GITHUB_TOKEN must be set in .env")

# app = Flask(__name__)
# CORS(app)

# GRAPHQL_URL = "https://api.github.com/graphql"
# HEADERS = {"Authorization": f"bearer {GITHUB_TOKEN}"}

# # defaults
# DEFAULT_PER_PAGE = 20
# MAX_GRAPHQL_FIRST = 100  # GitHub GraphQL 'first' reasonable cap

# # GraphQL search template (returns issueCount + nodes which we expect to be PullRequest nodes)
# GRAPHQL_SEARCH_PR = """
# query($q: String!, $first: Int!) {
#   search(query: $q, type: ISSUE, first: $first) {
#     issueCount
#     nodes {
#       ... on PullRequest {
#         title
#         number
#         url
#         state
#         createdAt
#         mergedAt
#         updatedAt
#         repository { nameWithOwner }
#       }
#     }
#   }
# }
# """

# def run_graphql(query, variables):
#     try:
#         r = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query, "variables": variables}, timeout=20)
#     except requests.RequestException as e:
#         return None, 500, str(e)
#     if r.status_code != 200:
#         return None, r.status_code, r.text
#     try:
#         return r.json(), 200, None
#     except Exception as e:
#         return None, 500, str(e)

# def format_node(node):
#     # node is the PullRequest object shaped by the query
#     repo_full = node.get("repository", {}).get("nameWithOwner") or ""
#     owner, repo = (repo_full.split("/", 1) + [""])[:2]
#     state = (node.get("state") or "").lower()
#     if node.get("mergedAt"):
#         state = "merged"
#     return {
#         "title": node.get("title"),
#         "number": node.get("number"),
#         "html_url": node.get("url"),
#         "state": state,
#         "created_at": node.get("createdAt"),
#         "updated_at": node.get("updatedAt"),
#         "repo_owner": owner,
#         "repo_name": repo,
#     }

# # map category to qualifier
# CATEGORY_TO_QUAL = {
#     "created": "author",
#     "assigned": "assignee",
#     "review-requested": "review-requested",
#     "reviewed": "reviewed-by"
# }



# @app.route("/api/prs/<category>")
# def prs_category(category):
#     """
#     GraphQL-based search for PRs.
#     category: created | assigned | review-requested | reviewed
#     Query params:
#       - username (required)
#       - page (default 1)
#       - per_page (default 20)
#     Response: { items: [...], total_count, page, per_page }
#     """
#     category = category.strip()
#     if category not in CATEGORY_TO_QUAL:
#         return jsonify({"error": f"Unsupported category '{category}'"}), 400

#     username = request.args.get("username", "").strip()
#     if not username:
#         return jsonify({"error": "Please provide 'username' query parameter."}), 400

#     try:
#         page = int(request.args.get("page", 1))
#         per_page = int(request.args.get("per_page", DEFAULT_PER_PAGE))
#     except ValueError:
#         return jsonify({"error": "page and per_page must be integers."}), 400
#     if page < 1 or per_page < 1:
#         return jsonify({"error": "page and per_page must be >= 1"}), 400

#     qualifier = CATEGORY_TO_QUAL[category]
#     # build search string: include type:pr to restrict to PRs
#     q = f"{qualifier}:{username} type:pr"

#     # GraphQL 'first' must be integer and capped; request page * per_page and slice
#     requested_first = page * per_page
#     first = requested_first if requested_first <= MAX_GRAPHQL_FIRST else MAX_GRAPHQL_FIRST

#     variables = {"q": q, "first": first}
#     data, status, err = run_graphql(GRAPHQL_SEARCH_PR, variables)
#     if data is None:
#         return jsonify({"error": f"GraphQL request failed: {err}"}), status

#     search = data.get("data", {}).get("search", {})
#     issue_count = search.get("issueCount", 0)
#     nodes = search.get("nodes", []) or []

#     # format nodes
#     formatted = [format_node(n) for n in nodes]

#     # if first < requested_first we might have truncated — still slice within what we have
#     start_idx = (page - 1) * per_page
#     end_idx = start_idx + per_page
#     page_items = formatted[start_idx:end_idx] if start_idx < len(formatted) else []

#     return jsonify({
#         "items": page_items,
#         "total_count": issue_count,
#         "page": page,
#         "per_page": per_page
#     }), 200

# @app.route("/api/health")
# def health():
#     return jsonify({"status": "ok"}), 200

# if __name__ == "__main__":
#     app.run(debug=True)




# # app.py
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# import os
# import requests
# from dotenv import load_dotenv

# load_dotenv()
# GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # token must have `repo` and `read:user` scopes

# app = Flask(__name__)
# CORS(app)

# GRAPHQL_URL = "https://api.github.com/graphql"
# HEADERS = {
#     "Authorization": f"bearer {GITHUB_TOKEN}"
# }

# PER_PAGE = 100  # default pagination size

# def run_graphql_query(query, variables=None):
#     payload = {"query": query}
#     if variables:
#         payload["variables"] = variables
#     response = requests.post(GRAPHQL_URL, headers=HEADERS, json=payload)
#     if response.status_code != 200:
#         return None, response.status_code, response.text
#     return response.json(), 200, None

# def parse_pr_node(node):
#     pr = node.get("pullRequest") or node.get("pullRequestReview", {}).get("pullRequest")
#     if not pr:
#         return None
#     repo = pr.get("repository", {})
#     owner = repo.get("owner", {}).get("login")
#     repo_name = repo.get("name")
#     return {
#         "title": pr.get("title"),
#         "html_url": pr.get("url"),
#         "state": pr.get("state").lower(),  # OPEN, MERGED, CLOSED
#         "created_at": pr.get("createdAt"),
#         "updated_at": pr.get("updatedAt"),
#         "repo_owner": owner,
#         "repo_name": repo_name
#     }

# @app.route("/api/user-prs/<string:category>")
# def user_prs(category):
#     """
#     category: created, assigned, review-requested, reviewed
#     """
#     username = request.args.get("username", "").strip()
#     if not username:
#         return jsonify({"error": "Please provide 'username' query parameter."}), 400
#     page = int(request.args.get("page", 1))
#     per_page = int(request.args.get("per_page", PER_PAGE))

#     # GraphQL query for user contributions
#     query = """
#     query($login: String!, $first: Int!) {
#       user(login: $login) {
#         createdPRs: contributionsCollection {
#           pullRequestContributions(first: $first) {
#             nodes { pullRequest { title url state createdAt updatedAt repository { name owner { login } } } }
#           }
#         }
#         reviewedPRs: contributionsCollection {
#           pullRequestReviewContributions(first: $first) {
#             nodes { pullRequest { title url state createdAt updatedAt repository { name owner { login } } } }
#           }
#         }
#       }
#     }
#     """
#     variables = {"login": username, "first": 100}  # fetch 100 items max per query

#     data, status, err = run_graphql_query(query, variables)
#     if not data:
#         return jsonify({"error": f"GraphQL request failed: {err}"}), status

#     user = data.get("data", {}).get("user")
#     if not user:
#         return jsonify({"error": "User not found or no public contributions."}), 404

#     items = []
#     if category == "created":
#         nodes = user.get("createdPRs", {}).get("pullRequestContributions", {}).get("nodes", [])
#         items = [parse_pr_node(n) for n in nodes if parse_pr_node(n)]
#     elif category == "reviewed":
#         nodes = user.get("reviewedPRs", {}).get("pullRequestReviewContributions", {}).get("nodes", [])
#         items = [parse_pr_node(n) for n in nodes if parse_pr_node(n)]
#     else:
#         return jsonify({"error": f"Unsupported category '{category}'"}), 400

#     # Pagination manually
#     start = (page - 1) * per_page
#     end = start + per_page
#     paged_items = items[start:end]

#     return jsonify({
#         "items": paged_items,
#         "total_count": len(items),
#         "page": page,
#         "per_page": per_page
#     }), 200


# if __name__ == "__main__":
#     app.run(debug=True)
