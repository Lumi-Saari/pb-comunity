FROM node:22.15.0-slim

RUN apt-get update --fix-missing \
 && apt-get install -y --no-install-recommends git locales || apt-get install -y git locales \
 && sed -i '/ja_JP.UTF-8/s/^# //g' /etc/locale.gen \
 && locale-gen \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

ENV LANG=ja_JP.UTF-8
ENV LANGUAGE=ja_JP:ja
ENV LC_ALL=ja_JP.UTF-8

WORKDIR /app