using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Data.Common;

namespace Soft_eng.Controllers
{
    public class BaseController : Controller
    {
        protected readonly MySqlConnection _connection;

        public BaseController(MySqlConnection connection)
        {
            _connection = connection;
        }

        protected DateTime? SafeGetDateTime(DbDataReader reader, string columnName)
        {
            try
            {
                int ordinal = reader.GetOrdinal(columnName);
                if (reader.IsDBNull(ordinal)) return null;

                if (reader is MySqlDataReader mySqlReader)
                {
                    try
                    {
                        var mySqlDateTime = mySqlReader.GetMySqlDateTime(ordinal);
                        if (mySqlDateTime.IsValidDateTime) return mySqlDateTime.GetDateTime();
                        return null;
                    }
                    catch
                    {
                        try
                        {
                            string strValue = mySqlReader.GetString(ordinal);
                            if (DateTime.TryParse(strValue, out DateTime dt)) return dt;
                        }
                        catch { }
                        return null;
                    }
                }
                return null;
            }
            catch { return null; }
        }
    }
}