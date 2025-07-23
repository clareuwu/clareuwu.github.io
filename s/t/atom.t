<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>claresies blog umu</title>
  <link href="clare.fyi" />
  <id>urn:uuid:32C0EBDC-D245-44D6-B4CA-D96966288E41</id>
  <updated>{{.Updated}}</updated>
  <author>
    <name>clare bear</name>
  </author>
  {{range .Posts}}
  <entry>
    <title>{{.Title}}</title>
    <link href="https://clare.fyi/posts/{{.Filename}}"/>
    <id>clare.fyi/posts/{{.Filename}}</id>
    <published>{{.Date.Format "January 2, 2006"}}</published>
  </entry>
  {{end}}
</feed>
