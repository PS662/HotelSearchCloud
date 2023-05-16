FROM debian:latest

WORKDIR /app

RUN apt-get update \
    && apt-get install -y curl gnupg \
    && curl -sL https://deb.nodesource.com/setup_19.x | bash - \
    && apt-get install -y nodejs

COPY *.js .
COPY package.json .

RUN npm install

EXPOSE 3001

# Start the application
CMD ["npm", "start"]