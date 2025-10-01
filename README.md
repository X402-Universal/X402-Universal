# X402-Universal


For devs

Switch between app contexts if working on /backend or /validator-service

heroku config --app backend-app
heroku config --app validator-service-app

OR

heroku open --app backend-app
heroku open --app validator-service-app


Test the /api/hello endpoint
https://validator-service-app-94f8eaf18c93.herokuapp.com

curl https://validator-service-app-94f8eaf18c93.herokuapp.com/api/hello

Set environment variables specific to validator-service
heroku config:set NODE_ENV=production --app validator-service-app

// temporarily set the default remote
heroku git:remote -a validator-service-app -r heroku