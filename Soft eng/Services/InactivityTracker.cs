using MySql.Data.MySqlClient;
using System.Data;

namespace Soft_eng.Services
{
    public interface IInactivityTracker
    {
        Task UpdateLastActivityAsync(string email);
        Task<int> GetInactivityMinutesAsync(string email);
    }

    public class InactivityTracker : IInactivityTracker
    {
        private readonly MySqlConnection _connection;

        public InactivityTracker(MySqlConnection connection)
        {
            _connection = connection;
        }

        public async Task UpdateLastActivityAsync(string email)
        {
            try
            {
                if (_connection.State != ConnectionState.Open)
                    await _connection.OpenAsync();

                using var cmd = new MySqlCommand(
                    "UPDATE Register SET LastLoginAt = NOW() WHERE Email = @email",
                    _connection);
                cmd.Parameters.AddWithValue("@email", email);
                await cmd.ExecuteNonQueryAsync();
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await _connection.CloseAsync();
            }
        }

        public async Task<int> GetInactivityMinutesAsync(string email)
        {
            try
            {
                if (_connection.State != ConnectionState.Open)
                    await _connection.OpenAsync();

                using var cmd = new MySqlCommand(
                    "SELECT TIMESTAMPDIFF(MINUTE, IFNULL(LastLoginAt, NOW()), NOW()) as InactiveMinutes FROM Register WHERE Email = @email",
                    _connection);
                cmd.Parameters.AddWithValue("@email", email);

                var result = await cmd.ExecuteScalarAsync();
                return result != null ? Convert.ToInt32(result) : 5;
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await _connection.CloseAsync();
            }
        }
    }
}