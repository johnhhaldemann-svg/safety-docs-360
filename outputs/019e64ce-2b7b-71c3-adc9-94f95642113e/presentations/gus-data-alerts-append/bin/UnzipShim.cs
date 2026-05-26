using System;
using System.IO;
using System.IO.Compression;
using System.Linq;

public static class UnzipShim
{
    public static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: unzip -Z1 <zip> | unzip -p <zip> <entry>");
            return 2;
        }

        var mode = args[0];
        var zipPath = args[1];

        try
        {
            if (mode == "-Z1")
            {
                using (var archive = ZipFile.OpenRead(zipPath))
                {
                    foreach (var entry in archive.Entries)
                    {
                        Console.Out.WriteLine(entry.FullName);
                    }
                }
                return 0;
            }

            if (mode == "-p")
            {
                if (args.Length < 3)
                {
                    Console.Error.WriteLine("Missing zip entry");
                    return 2;
                }

                var entryName = args[2];
                using (var archive = ZipFile.OpenRead(zipPath))
                {
                    var entry = archive.Entries.FirstOrDefault(e => e.FullName == entryName);
                    if (entry == null)
                    {
                        Console.Error.WriteLine("Entry not found: " + entryName);
                        return 11;
                    }

                    using (var input = entry.Open())
                    using (var output = Console.OpenStandardOutput())
                    {
                        input.CopyTo(output);
                    }
                }
                return 0;
            }

            Console.Error.WriteLine("Unsupported unzip mode: " + mode);
            return 2;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }
}
