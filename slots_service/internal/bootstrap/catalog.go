// Package bootstrap assembles engines, infrastructure and transports at process startup.
package bootstrap

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"fmt"
	"io"
)

type Catalog struct {
	current  map[string]string
	versions map[string]map[string]bet.Spinner
	files    []io.Closer
}

func LoadCatalog(config Config) (*Catalog, error) {
	return LoadCatalogWithFactories(config, builtInFactories())
}

// LoadCatalogWithFactories selects a rules factory explicitly. Unknown/missing types never fall back.
// Additional game families register a factory here without modifying the bet/settlement flow.
func LoadCatalogWithFactories(config Config, factories map[string]Factory) (*Catalog, error) {
	c := &Catalog{current: map[string]string{}, versions: map[string]map[string]bet.Spinner{}}
	fail := func(err error) (*Catalog, error) { c.Close(); return nil, err }
	for _, spec := range config.Games {
		var err error
		spec.RuleType, err = gamedata.ReadRuleType(spec.ConfigDir)
		if err != nil {
			return fail(err)
		}
		factory := factories[spec.RuleType]
		if spec.RuleType == "" || factory == nil {
			return fail(fmt.Errorf("unsupported ruleType %q", spec.RuleType))
		}
		loaded, err := factory(spec)
		if err != nil {
			return fail(err)
		}
		if loaded.Closer != nil {
			c.files = append(c.files, loaded.Closer)
		}
		if loaded.GameID == "" || loaded.Engine == nil || loaded.Engine.Version() == "" || loaded.Engine.Type() != spec.RuleType {
			return fail(fmt.Errorf("invalid rules factory result for %q", spec.RuleType))
		}
		id, e := loaded.GameID, loaded.Engine
		if c.versions[id] == nil {
			c.versions[id] = map[string]bet.Spinner{}
		}
		if _, ok := c.versions[id][e.Version()]; ok {
			return fail(fmt.Errorf("duplicate game version %s/%s", id, e.Version()))
		}
		c.versions[id][e.Version()] = e
		if spec.Current {
			if c.current[id] != "" {
				return fail(fmt.Errorf("multiple current versions for %s", id))
			}
			c.current[id] = e.Version()
		}
	}
	for id := range c.versions {
		if c.current[id] == "" {
			return fail(fmt.Errorf("no current version for %s", id))
		}
	}
	return c, nil
}
func (c *Catalog) Resolve(id, version string) (bet.Spinner, error) {
	if version == "" {
		version = c.current[id]
	}
	if e := c.versions[id][version]; e != nil {
		return e, nil
	}
	return nil, fmt.Errorf("%w: %s/%s", bet.ErrGameUnavailable, id, version)
}
func (c *Catalog) Count() int { return len(c.current) }

// Close only after draining all in-flight requests. A catalog is immutable after construction.
func (c *Catalog) Close() error {
	var first error
	for _, file := range c.files {
		if err := file.Close(); err != nil && first == nil {
			first = err
		}
	}
	return first
}
