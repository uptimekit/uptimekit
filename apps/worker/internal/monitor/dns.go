package monitor

import (
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/miekg/dns"
)

const defaultDNSResolver = "1.1.1.1"
const defaultDNSPort = 53

var supportedDNSRecordTypes = map[string]uint16{
	"A":     dns.TypeA,
	"AAAA":  dns.TypeAAAA,
	"CAA":   dns.TypeCAA,
	"CNAME": dns.TypeCNAME,
	"MX":    dns.TypeMX,
	"NS":    dns.TypeNS,
	"PTR":   dns.TypePTR,
	"SOA":   dns.TypeSOA,
	"SRV":   dns.TypeSRV,
	"TXT":   dns.TypeTXT,
}

type dnsResolver struct {
	address string
}

// DNSMonitor implements DNS record monitoring.
type DNSMonitor struct{}

// NewDNSMonitor creates a new DNS monitor.
func NewDNSMonitor() *DNSMonitor {
	return &DNSMonitor{}
}

// Check queries the configured resolver for the requested DNS record.
func (m *DNSMonitor) Check(cfg Config) Result {
	result := Result{
		MonitorID: cfg.ID,
		Status:    StatusDown,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if cfg.Hostname == "" {
		result.Error = "missing hostname"
		return result
	}

	recordType := strings.ToUpper(strings.TrimSpace(cfg.RecordType))
	if recordType == "" {
		recordType = "A"
	}

	qtype, ok := supportedDNSRecordTypes[recordType]
	if !ok {
		result.Error = "unsupported DNS record type: " + recordType
		return result
	}

	timeout := time.Duration(cfg.Timeout) * time.Second
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	resolvers, err := parseDNSResolvers(cfg.ResolverServers, cfg.Port)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	errors := make([]string, 0, len(resolvers))
	for _, resolver := range resolvers {
		values, latency, err := m.lookup(cfg.Hostname, qtype, resolver.address, timeout)
		result.Latency = latency
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: %s", resolver.address, err.Error()))
			continue
		}

		if !dnsExpectedValueMatches(cfg.ExpectedValue, values) {
			errors = append(errors, fmt.Sprintf(
				"%s: expected %q in DNS answers [%s]",
				resolver.address,
				cfg.ExpectedValue,
				strings.Join(values, ", "),
			))
			continue
		}

		result.Status = StatusUp
		return result
	}

	result.Error = strings.Join(errors, "; ")
	return result
}

func (m *DNSMonitor) lookup(hostname string, qtype uint16, resolver string, timeout time.Duration) ([]string, int64, error) {
	message := new(dns.Msg)
	message.SetQuestion(dns.Fqdn(hostname), qtype)
	message.RecursionDesired = true

	client := &dns.Client{
		Net:     "udp",
		Timeout: timeout,
	}

	start := time.Now()
	response, _, err := client.Exchange(message, resolver)
	if err != nil {
		return nil, time.Since(start).Milliseconds(), err
	}

	if response != nil && response.Truncated {
		client.Net = "tcp"
		response, _, err = client.Exchange(message, resolver)
		if err != nil {
			return nil, time.Since(start).Milliseconds(), err
		}
	}

	latency := time.Since(start).Milliseconds()
	if response == nil {
		return nil, latency, fmt.Errorf("empty DNS response")
	}

	if response.Rcode != dns.RcodeSuccess {
		responseCode := dns.RcodeToString[response.Rcode]
		if responseCode == "" {
			responseCode = strconv.Itoa(response.Rcode)
		}
		return nil, latency, fmt.Errorf("DNS response code %s", responseCode)
	}

	values := dnsRecordValues(response.Answer, qtype)
	if len(values) == 0 {
		recordType := dns.TypeToString[qtype]
		if recordType == "" {
			recordType = strconv.Itoa(int(qtype))
		}
		return nil, latency, fmt.Errorf("no %s records found", recordType)
	}

	return values, latency, nil
}

func parseDNSResolvers(raw string, port int) ([]dnsResolver, error) {
	if port == 0 {
		port = defaultDNSPort
	}

	if port < 1 || port > 65535 {
		return nil, fmt.Errorf("invalid DNS port: %d", port)
	}

	if strings.TrimSpace(raw) == "" {
		raw = defaultDNSResolver
	}

	parts := strings.Split(raw, ",")
	resolvers := make([]dnsResolver, 0, len(parts))
	for _, part := range parts {
		host := strings.TrimSpace(part)
		if host == "" {
			continue
		}

		resolverPort := port
		if splitHost, splitPort, err := net.SplitHostPort(host); err == nil {
			parsedPort, err := strconv.Atoi(splitPort)
			if err != nil || parsedPort < 1 || parsedPort > 65535 {
				return nil, fmt.Errorf("invalid DNS resolver port: %s", splitPort)
			}
			host = splitHost
			resolverPort = parsedPort
		}

		resolvers = append(resolvers, dnsResolver{
			address: net.JoinHostPort(host, strconv.Itoa(resolverPort)),
		})
	}

	if len(resolvers) == 0 {
		resolvers = append(resolvers, dnsResolver{
			address: net.JoinHostPort(defaultDNSResolver, strconv.Itoa(port)),
		})
	}

	return resolvers, nil
}

func dnsRecordValues(records []dns.RR, qtype uint16) []string {
	values := make([]string, 0, len(records))
	for _, record := range records {
		if record.Header().Rrtype != qtype {
			continue
		}

		switch typedRecord := record.(type) {
		case *dns.A:
			values = append(values, typedRecord.A.String())
		case *dns.AAAA:
			values = append(values, typedRecord.AAAA.String())
		case *dns.CAA:
			values = append(values, strings.TrimSpace(typedRecord.Tag+" "+typedRecord.Value))
		case *dns.CNAME:
			values = append(values, typedRecord.Target)
		case *dns.MX:
			values = append(values, typedRecord.Mx)
		case *dns.NS:
			values = append(values, typedRecord.Ns)
		case *dns.PTR:
			values = append(values, typedRecord.Ptr)
		case *dns.SOA:
			values = append(values, strings.TrimSpace(typedRecord.Ns+" "+typedRecord.Mbox))
		case *dns.SRV:
			values = append(values, fmt.Sprintf(
				"%d %d %d %s",
				typedRecord.Priority,
				typedRecord.Weight,
				typedRecord.Port,
				typedRecord.Target,
			))
		case *dns.TXT:
			values = append(values, strings.Join(typedRecord.Txt, ""))
		}
	}
	return values
}

func dnsExpectedValueMatches(expectedValue string, values []string) bool {
	expectedValue = strings.TrimSpace(expectedValue)
	if expectedValue == "" {
		return true
	}

	normalizedExpected := normalizeDNSValue(expectedValue)
	for _, value := range values {
		normalizedValue := normalizeDNSValue(value)
		if normalizedValue == normalizedExpected || strings.Contains(normalizedValue, normalizedExpected) {
			return true
		}
	}

	return false
}

func normalizeDNSValue(value string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(value)), ".")
}
