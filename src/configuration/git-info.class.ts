import { execSync } from "child_process";

export class GitInfo {
  commitDate = '';
  commitSha = '';
  branchName = '';
  error = '';

  constructor() {
    this.getGitInfo();
  }
  getGitInfo() {
    try {
      const commitDate = execSync(
        'git log -1 --format=%cd --date=format:"%Y-%m-%d"',
      )
        .toString()
        .trim();
      const commitSha = execSync('git rev-parse --short HEAD')
        .toString()
        .trim();
      const branchName = execSync('git rev-parse --abbrev-ref HEAD')
        .toString()
        .trim();
      this.branchName = branchName;
      this.commitDate = commitDate;
      this.commitSha = commitSha;
    } catch (error) {
      this.error = 'Error fetching Git information';
    }
  }
}
