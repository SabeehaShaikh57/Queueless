# Deployment Checklist

## Before Deploy

- [ ] MongoDB Atlas cluster created and network access configured
- [ ] Database user created with read/write access
- [ ] Strong `JWT_SECRET` generated
- [ ] `CORS_ORIGIN` set to your final app URL
- [ ] Optional admin seed values configured

## Render Deploy

- [ ] Push repository to GitHub
- [ ] Create Blueprint in Render using this repo
- [ ] Confirm service uses [render.yaml](render.yaml)
- [ ] Add variables from [env.render.example](env.render.example)
- [ ] Deploy and wait for healthy status
- [ ] Open `/api/health` and verify `status: ok`

## Railway Deploy

- [ ] Create Railway project from GitHub repo
- [ ] Confirm project detects [railway.json](railway.json)
- [ ] Add variables from [env.railway.example](env.railway.example)
- [ ] Deploy and verify root page + `/api/health`

## Post Deploy Smoke Test

- [ ] User registration works
- [ ] User login works
- [ ] Admin login works
- [ ] Business list loads
- [ ] Queue join/cancel works
- [ ] Socket updates appear in real-time
