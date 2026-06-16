FROM ubuntu

RUN apt-get update
RUN apt-get install curl

RUN apt-get install -y nodejs
RUN apt-get install -y git

WORKDIR /home/app

COPY main.sh main.sh
COPY script.js script.js

ENTRYPOINT [ "/home/app/main.sh" ]