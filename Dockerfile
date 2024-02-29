FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18-alpine
LABEL maintainer="Oussama Tali <o.tali@nuitee.com>"

# Install OS dependencies
RUN apk add --no-cache curl zsh git emacs vim;

# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#global-npm-dependencies
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

# Create app directory
WORKDIR /usr/src/app

# Copy app source
COPY . /usr/src/app

EXPOSE 80

# Build the backend
RUN npm install

# Run the app
CMD [ "npm", "run", "start" ]
