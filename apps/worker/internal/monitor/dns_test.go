package monitor

import (
	"net"
	"strconv"
	"testing"

	"github.com/miekg/dns"
)

func TestDNSMonitorCheckSucceedsWhenExpectedAnswerIsPresent(t *testing.T) {
	resolverHost, resolverPort := startTestDNSServer(t, func(request *dns.Msg) *dns.Msg {
		response := new(dns.Msg)
		response.SetReply(request)

		if len(request.Question) == 0 {
			return response
		}

		question := request.Question[0]
		if question.Name == "example.com." && question.Qtype == dns.TypeA {
			record, err := dns.NewRR("example.com. 60 IN A 203.0.113.10")
			if err != nil {
				t.Fatalf("dns.NewRR() error = %v", err)
			}
			response.Answer = append(response.Answer, record)
		}

		return response
	})

	result := NewDNSMonitor().Check(Config{
		ID:              "monitor-1",
		Hostname:        "example.com",
		ResolverServers: resolverHost,
		Port:            resolverPort,
		RecordType:      "A",
		ExpectedValue:   "203.0.113.10",
		Timeout:         2,
	})

	if result.Status != StatusUp {
		t.Fatalf("Check() status = %q, want %q; error = %q", result.Status, StatusUp, result.Error)
	}
}

func TestDNSMonitorCheckFailsWhenExpectedAnswerIsMissing(t *testing.T) {
	resolverHost, resolverPort := startTestDNSServer(t, func(request *dns.Msg) *dns.Msg {
		response := new(dns.Msg)
		response.SetReply(request)

		if len(request.Question) > 0 && request.Question[0].Qtype == dns.TypeTXT {
			record, err := dns.NewRR(`example.com. 60 IN TXT "v=spf1 -all"`)
			if err != nil {
				t.Fatalf("dns.NewRR() error = %v", err)
			}
			response.Answer = append(response.Answer, record)
		}

		return response
	})

	result := NewDNSMonitor().Check(Config{
		ID:              "monitor-1",
		Hostname:        "example.com",
		ResolverServers: resolverHost,
		Port:            resolverPort,
		RecordType:      "TXT",
		ExpectedValue:   "google-site-verification",
		Timeout:         2,
	})

	if result.Status != StatusDown {
		t.Fatalf("Check() status = %q, want %q", result.Status, StatusDown)
	}

	if result.Error == "" {
		t.Fatal("Check() error is empty, want expected-answer error")
	}
}

func TestDefaultRegistryIncludesDNSMonitor(t *testing.T) {
	if DefaultRegistry().Get("dns") == nil {
		t.Fatal("DefaultRegistry().Get(\"dns\") is nil")
	}
}

func startTestDNSServer(t *testing.T, handler func(*dns.Msg) *dns.Msg) (string, int) {
	t.Helper()

	packetConn, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.ListenPacket() error = %v", err)
	}

	mux := dns.NewServeMux()
	mux.HandleFunc(".", func(writer dns.ResponseWriter, request *dns.Msg) {
		if err := writer.WriteMsg(handler(request)); err != nil {
			t.Errorf("writer.WriteMsg() error = %v", err)
		}
	})

	server := &dns.Server{
		PacketConn: packetConn,
		Handler:    mux,
	}

	go func() {
		_ = server.ActivateAndServe()
	}()

	t.Cleanup(func() {
		_ = server.Shutdown()
		_ = packetConn.Close()
	})

	host, rawPort, err := net.SplitHostPort(packetConn.LocalAddr().String())
	if err != nil {
		t.Fatalf("net.SplitHostPort() error = %v", err)
	}

	port, err := strconv.Atoi(rawPort)
	if err != nil {
		t.Fatalf("strconv.Atoi() error = %v", err)
	}

	return host, port
}
