namespace Soft_eng.Services
{
    public class SessionService
    {
        private readonly Dictionary<string, string> _activeSessions = new();

        public string CreateSession(string userId)
        {
            var token = Guid.NewGuid().ToString();
            _activeSessions[userId] = token;
            return token;
        }

        public bool IsValidSession(string userId, string token)
        {
            return _activeSessions.TryGetValue(userId, out var stored) && stored == token;
        }
    }
}