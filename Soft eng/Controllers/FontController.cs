using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Soft_eng.Controllers
{
    /// <summary>
    /// Controller for handling font detection using WhatTheFont (MyFonts) API
    /// Keeps API key secure on the server-side
    /// </summary>
    [Route("api/what-the-font")]
    [ApiController]
    public class FontController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly ILogger<FontController> _logger;
        private readonly HttpClient _httpClient;

        public FontController(
            IConfiguration config,
            ILogger<FontController> logger,
            IHttpClientFactory httpClientFactory)
        {
            _config = config;
            _logger = logger;
            _httpClient = httpClientFactory.CreateClient();
        }

        /// <summary>
        /// Detects fonts from an uploaded image using WhatTheFont API
        /// </summary>
        /// <param name="image">The image file containing text</param>
        /// <returns>JSON response with font suggestions</returns>
        [HttpPost]
        [RequestSizeLimit(10_485_760)] // 10MB limit
        public async Task<IActionResult> DetectFont(IFormFile image)
        {
            // Validate input
            if (image == null || image.Length == 0)
            {
                _logger.LogWarning("Font detection request with no image");
                return BadRequest(new { error = "No image uploaded" });
            }

            // Validate file type
            var allowedTypes = new[] { "image/png", "image/jpeg", "image/jpg" };
            if (!allowedTypes.Contains(image.ContentType.ToLower()))
            {
                _logger.LogWarning($"Invalid file type: {image.ContentType}");
                return BadRequest(new { error = "Only PNG and JPEG images are supported" });
            }

            // Validate file size (max 5MB for API efficiency)
            if (image.Length > 5_242_880)
            {
                _logger.LogWarning($"Image too large: {image.Length} bytes");
                return BadRequest(new { error = "Image must be smaller than 5MB" });
            }

            try
            {
                // Get API key from configuration
                var apiKey = _config["WhatTheFont:ApiKey"];

                if (string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogError("WhatTheFont API key not configured");
                    return StatusCode(500, new { error = "Font detection service not configured" });
                }

                // Prepare HTTP request
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", apiKey);

                // Create multipart form data
                using var content = new MultipartFormDataContent();
                using var stream = image.OpenReadStream();
                using var streamContent = new StreamContent(stream);

                streamContent.Headers.ContentType =
                    new MediaTypeHeaderValue(image.ContentType);

                content.Add(streamContent, "image", image.FileName);

                _logger.LogInformation($"Sending font detection request for: {image.FileName}");

                // Call WhatTheFont API
                var response = await _httpClient.PostAsync(
                    "https://api.myfonts.com/v1/what-the-font",
                    content
                );

                var jsonResponse = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"WhatTheFont API error: {response.StatusCode} - {jsonResponse}");

                    return StatusCode((int)response.StatusCode, new
                    {
                        error = "Font detection service error",
                        details = jsonResponse
                    });
                }

                _logger.LogInformation("Font detection successful");

                // Parse and normalize response
                var fontResults = JsonSerializer.Deserialize<WhatTheFontResponse>(jsonResponse);

                return Ok(fontResults);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP request error during font detection");
                return StatusCode(503, new { error = "Font detection service unavailable" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error during font detection");
                return StatusCode(500, new { error = "An unexpected error occurred" });
            }
        }

        /// <summary>
        /// Health check endpoint to verify API configuration
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
        {
            var hasApiKey = !string.IsNullOrEmpty(_config["WhatTheFont:ApiKey"]);

            return Ok(new
            {
                status = "ok",
                configured = hasApiKey,
                timestamp = DateTime.UtcNow
            });
        }
    }

    #region Response Models

    /// <summary>
    /// Response model for WhatTheFont API
    /// </summary>
    public class WhatTheFontResponse
    {
        public List<FontResult> Results { get; set; } = new();
    }

    public class FontResult
    {
        public string FontName { get; set; }
        public string FoundryName { get; set; }
        public decimal MatchScore { get; set; }
        public string Url { get; set; }
        public List<string> Variants { get; set; } = new();
    }

    #endregion
}