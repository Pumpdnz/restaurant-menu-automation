1. Add the recently modified and created files to git using git add "path-to-file" for each modified or created file
2. Commit the changes with a meaningful message: git commit -m "Meaningful message"
3. Push the changes to github with "git push origin main"
4. (Conditional) Check for meaningful server changes and push to Heroku only if needed:

  if git diff --name-only HEAD~1 | grep "^server/.*\.\(js\|ts\|json\|sql\)$" | grep -v "^server/scripts/"; then
      echo "Server application changes detected, deploying to Heroku..."
      git push heroku main
  else
      echo "No server application changes detected, skipping Heroku push"
  fi