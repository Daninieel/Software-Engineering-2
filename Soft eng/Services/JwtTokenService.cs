using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Soft_eng.Services
{
    public interface IJwtTokenService
    {
        string GenerateAccessToken(string userEmail, string fullName, string userRole);
        ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
    }

    public class JwtTokenService : IJwtTokenService
    {
        private readonly IConfiguration _configuration;
        private readonly string _secretKey;
        private readonly string _issuer;
        private readonly string _audience;

        public JwtTokenService(IConfiguration configuration)
        {
            _configuration = configuration;
            _secretKey = _configuration["Jwt:SecretKey"] 
                ?? "SaintIsidoreAcademy-LibrarySystem-SecureKey-MinimumLength32!";
            _issuer = _configuration["Jwt:Issuer"] ?? "SaintIsidoreAcademy";
            _audience = _configuration["Jwt:Audience"] ?? "SaintIsidoreLibraryApp";
        }

        public string GenerateAccessToken(string userEmail, string fullName, string userRole)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_secretKey);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, userEmail),
                new Claim(ClaimTypes.Name, fullName),
                new Claim(ClaimTypes.Role, userRole),
                new Claim("IssuedAt", DateTime.UtcNow.ToString("O"))
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(5),
                Issuer = _issuer,
                Audience = _audience,
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_secretKey);

            try
            {
                var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = true,
                    ValidIssuer = _issuer,
                    ValidateAudience = true,
                    ValidAudience = _audience,
                    ValidateLifetime = false,
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken securityToken);

                if (!(securityToken is JwtSecurityToken jwtSecurityToken) ||
                    !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256,
                        StringComparison.InvariantCultureIgnoreCase))
                {
                    return null;
                }

                return principal;
            }
            catch
            {
                return null;
            }
        }
    }
}