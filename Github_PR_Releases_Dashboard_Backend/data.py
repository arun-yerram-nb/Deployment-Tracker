import os
import asyncio
import aiohttp
from flask import Flask, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
ORG_NAME = "NationsBenefits"

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

# -----------------------------------------
# Generic pagination fetch
# -----------------------------------------
async def fetch_all_pages(session, url):
    results = []
    page = 1

    while True:
        paginated_url = f"{url}?per_page=100&page={page}"

        async with session.get(paginated_url, headers=HEADERS) as resp:
            if resp.status != 200:
                print(f"Error {resp.status}: {await resp.text()}")
                break

            data = await resp.json()
            if not data:
                break

            results.extend(data)
            page += 1

    return results


# -----------------------------------------
# Get all repos
# -----------------------------------------
async def fetch_all_repos(session):
    url = f"https://api.github.com/orgs/{ORG_NAME}/repos"
    repos = await fetch_all_pages(session, url)
    return [repo["name"] for repo in repos]


# -----------------------------------------
# Get contributors for a repo
# -----------------------------------------
async def fetch_contributors(session, repo_name):
    url = f"https://api.github.com/repos/{ORG_NAME}/{repo_name}/contributors"
    contributors = await fetch_all_pages(session, url)
    return [user["login"] for user in contributors]


# -----------------------------------------
# SERVICE: Get all repos
# -----------------------------------------
async def get_all_repos_service():
    async with aiohttp.ClientSession() as session:
        repo_names = await fetch_all_repos(session)
        return repo_names

async def fetch_tags(session, repo_name):
    url = f"https://api.github.com/repos/{ORG_NAME}/{repo_name}/tags"
    tags = await fetch_all_pages(session, url)
    return [tag["name"] for tag in tags]



async def get_all_tags_service():
    async with aiohttp.ClientSession() as session:

        # Step 1: get repos
        repo_names = await fetch_all_repos(session)

        # (optional) filter igloo repos
        repo_names = [r for r in repo_names if r.startswith("igloo")]

        semaphore = asyncio.Semaphore(10)

        async def limited_fetch(repo):
            async with semaphore:
                return await fetch_tags(session, repo)

        tasks = [limited_fetch(repo) for repo in repo_names]
        results = await asyncio.gather(*tasks)

        # Step 2: flatten + unique
        all_tags = set()
        for tag_list in results:
            all_tags.update(tag_list)

        # Step 3: sort
        return sorted(all_tags, key=lambda x: x.lower())
    
    
# -----------------------------------------
# SERVICE: Get all unique users
# -----------------------------------------
async def get_all_users_service():
    async with aiohttp.ClientSession() as session:

        repo_names = await fetch_all_repos(session)

        semaphore = asyncio.Semaphore(10)

        async def limited_fetch(repo):
            async with semaphore:
                return await fetch_contributors(session, repo)

        tasks = [limited_fetch(repo) for repo in repo_names]
        results = await asyncio.gather(*tasks)

        unique_users = set()
        for users in results:
            unique_users.update(users)

        return list(unique_users)


# -----------------------------------------
# ROUTE 1: All Repos
# -----------------------------------------
@app.route("/all-repos", methods=["GET"])
def all_repos():
    repos = asyncio.run(get_all_repos_service())

    return jsonify({
        "organization": ORG_NAME,
        "total_repos": len(repos),
        "repos": repos
    })


# -----------------------------------------
# ROUTE 2: All Users
# -----------------------------------------
@app.route("/all-users", methods=["GET"])
def all_users():
    users = asyncio.run(get_all_users_service())

    return jsonify({
        "organization": ORG_NAME,
        "total_users": len(users),
        "users": users
    })


@app.route("/all-tags", methods=["GET"])
def all_tags():
    tags = asyncio.run(get_all_tags_service())

    return jsonify({
        "organization": ORG_NAME,
        "total_tags": len(tags),
        "tags": tags
    })

# -----------------------------------------
# Run Flask App
# -----------------------------------------
if __name__ == "__main__":
    app.run(debug=True)
    
    
    

# import requests
 
# url = "https://api.github.com/rate_limit"
# headers = {"Authorization": "token "}
 
# response = requests.get(url, headers=headers)
# print(response.json())                                