import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',workers:1,retries:0,timeout:60000,use:{baseURL:process.env.BASE_URL??'http://localhost:8080',browserName:'chromium',trace:'retain-on-failure'},reporter:[['list'],['html',{open:'never'}]]});
