import yaml from 'js-yaml';
import fs from 'fs';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyCss } from 'csso';
import { minify as minifyJs } from 'terser';
import crypto from 'crypto';

export default function(eleventyConfig) {
  // Add YAML data file support
  eleventyConfig.addDataExtension("yaml", contents => yaml.load(contents));
  
  // Copy static assets
  eleventyConfig.addPassthroughCopy({ "site/src/robots.txt": "robots.txt" });
  eleventyConfig.addPassthroughCopy({ "site/src/humans.txt": "humans.txt" });
  eleventyConfig.addPassthroughCopy({ "site/src/.well-known": ".well-known" });
  
  // Process CSS with minification
  eleventyConfig.addTemplateFormats("css");
  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: async function(inputContent) {
      return async () => {
        const minified = minifyCss(inputContent).css;
        return minified;
      };
    }
  });
  
  // Process JS with minification
  eleventyConfig.addTemplateFormats("js");
  eleventyConfig.addExtension("js", {
    outputFileExtension: "js",
    compile: async function(inputContent, inputPath) {
      // Skip if it's a config file
      if (inputPath.includes('eleventy.config')) {
        return false;
      }
      return async () => {
        const minified = await minifyJs(inputContent, {
          compress: true,
          mangle: true
        });
        return minified.code;
      };
    }
  });
  
  // Add filters for template
  eleventyConfig.addFilter("percent", (value, total) => {
    return Math.round((value / total) * 100);
  });
  
  eleventyConfig.addFilter("isoDate", (date) => {
    return new Date(date).toISOString();
  });
  
  eleventyConfig.addFilter("shortDate", (date) => {
    return new Date(date).toISOString().split('T')[0];
  });
  
  eleventyConfig.addFilter("statusEmoji", (status) => {
    const emojis = {
      full: '✅',
      partial: '🟨',
      none: '❌',
      unknown: '❓'
    };
    return emojis[status] || '❓';
  });
  
  eleventyConfig.addFilter("testIcon", (result) => {
    if (result === true) return '✅';
    if (result === false) return '❌';
    return '❓';
  });
  
  // Sort services by status then name
  eleventyConfig.addFilter("sortServices", (services) => {
    const statusOrder = { full: 0, partial: 1, none: 2, unknown: 3 };
    return [...services].sort((a, b) => {
      const statusDiff = statusOrder[a.ipv6.status] - statusOrder[b.ipv6.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });
  });
  
  // Count services by status
  eleventyConfig.addFilter("countByStatus", (services, status) => {
    return services.filter(s => s.ipv6 && s.ipv6.status === status).length;
  });
  
  // Get statistics object
  eleventyConfig.addFilter("getStats", (services) => {
    return {
      total: services.length,
      full: services.filter(s => s.ipv6 && s.ipv6.status === 'full').length,
      partial: services.filter(s => s.ipv6 && s.ipv6.status === 'partial').length,
      none: services.filter(s => s.ipv6 && s.ipv6.status === 'none').length,
      unknown: services.filter(s => s.ipv6 && s.ipv6.status === 'unknown').length
    };
  });
  
  // Filter visible tests
  eleventyConfig.addFilter("visibleTests", (tests) => {
    return tests.filter(test => test.result !== null);
  });
  
  // Add global data
  eleventyConfig.addGlobalData("generated", () => new Date());
  
  // Add services data in a more accessible way
  eleventyConfig.addGlobalData("serviceList", async () => {
    const dataFile = fs.readFileSync('data/services.yaml', 'utf8');
    const data = yaml.load(dataFile);
    return data.services;
  });
  
  // Minify HTML in production
  eleventyConfig.addTransform("htmlmin", function(content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      return minifyHtml(content, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true
      });
    }
    return content;
  });
  
  // Generate API JSON from services data
  eleventyConfig.on('eleventy.after', async ({ dir, results, runMode, outputMode }) => {
    const dataFile = fs.readFileSync('data/services.yaml', 'utf8');
    const data = yaml.load(dataFile);
    fs.writeFileSync('site/dist/api.json', JSON.stringify(data, null, 2));
  });
  
  return {
    dir: {
      input: "site/src",
      output: "site/dist",
      includes: "_includes",
      data: "../../data"
    },
    templateFormats: ["html", "njk", "md", "css", "js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};