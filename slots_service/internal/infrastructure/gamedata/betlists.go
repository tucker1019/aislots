package gamedata

import (
	"aislots/slots_service/internal/application/betlist"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

func LoadBetPolicies(path string) ([]betlist.Policy, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	var policies []betlist.Policy
	if err = d.Decode(&policies); err != nil {
		return nil, err
	}
	if err = d.Decode(new(any)); err != io.EOF {
		return nil, fmt.Errorf("trailing bet policy data")
	}
	if _, err = betlist.New(policies); err != nil {
		return nil, err
	}
	return policies, nil
}
